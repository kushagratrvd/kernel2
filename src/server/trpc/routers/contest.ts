import { createTRPCRouter, protectedProcedure, adminProcedure, creatorOrReviewerProcedure } from "../init";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, ne, or, asc, desc } from "drizzle-orm";
import { contest, contestQuestion, contestParticipation, submission } from "@/server/db/contest-schema";
import { question, questionVersion } from "@/server/db/question-bank-schema";
import { auditLog } from "@/server/db/audit-schema";
import { executeSubmission, checkOutputsMatch } from "@/server/codebox";

// ─── Type helpers ─────────────────────────────────────────────────────────────

type TestCase = { input: string; expectedOutput: string; isSample: boolean };
type MCQOption = { id: string; text: string };

function getVersionContent(version: typeof questionVersion.$inferSelect) {
  return {
    title: version.title,
    description: version.description,
    options: version.options as MCQOption[] | null,
    correctOptionId: version.correctOptionId,
    hint: version.hint,
    questionScore: version.questionScore,
    starterCode: version.starterCode as Record<string, string> | null,
    allowedLanguages: version.allowedLanguages as number[] | null,
    timeLimit: version.timeLimit,
    memoryLimit: version.memoryLimit,
    testCases: version.testCases as TestCase[] | null,
  };
}

async function resolveContestQuestion(
  db: any,
  contestId: string,
  targetId?: string
) {
  if (!targetId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Question ID must be specified." });
  }

  let cq = await db.query.contestQuestion.findFirst({
    where: eq(contestQuestion.id, targetId),
    with: { version: true, question: { columns: { id: true, questionType: true } } },
  });

  if (!cq) {
    cq = await db.query.contestQuestion.findFirst({
      where: and(
        eq(contestQuestion.contestId, contestId),
        eq(contestQuestion.questionId, targetId)
      ),
      with: { version: true, question: { columns: { id: true, questionType: true } } },
    });
  }

  if (!cq) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Question not found in this contest." });
  }

  return cq;
}

export const contestRouter = createTRPCRouter({
  // ─── Student Endpoints ────────────────────────────────────────────────────

  // Get contest by code (for student cover & attempt pages)
  getByCode: protectedProcedure
    .input(z.object({ code: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const foundContest = await ctx.db.query.contest.findFirst({
        where: eq(contest.code, input.code),
        with: {
          contestQuestions: {
            orderBy: (cq, { asc }) => [asc(cq.questionOrder)],
            with: {
              version: true,
              question: { columns: { id: true, questionType: true } },
            },
          },
        },
      });

      if (!foundContest) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contest not found with this code.",
        });
      }

      if (!foundContest.isActive) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This contest is not active yet.",
        });
      }

      const participation = await ctx.db.query.contestParticipation.findFirst({
        where: and(
          eq(contestParticipation.contestId, foundContest.id),
          eq(contestParticipation.userId, ctx.user.id)
        ),
        with: { submissions: true },
      });

      // Shape questions for student view — only sample test cases exposed
      const questions = foundContest.contestQuestions.map((cq) => {
        const content = getVersionContent(cq.version);
        const sampleTestCases = (content.testCases ?? []).filter((tc) => tc.isSample);
        const optionsList = content.options
          ? content.options.map((opt) => (typeof opt === "string" ? opt : (opt as MCQOption).text))
          : null;

        return {
          id: cq.id, // contestQuestion id (used for submissions)
          contestQuestionId: cq.id,
          questionId: cq.question.id,
          questionType: cq.question.questionType,
          questionOrder: cq.questionOrder,
          marks: cq.marks,
          questionScore: cq.marks,
          title: content.title,
          questionText: content.title,
          description: content.description,
          options: optionsList,
          structuredOptions: content.options,
          correctOption: content.correctOptionId,
          hint: content.hint,
          starterCode: content.starterCode,
          allowedLanguages: content.allowedLanguages,
          timeLimit: content.timeLimit,
          memoryLimit: content.memoryLimit,
          testCases: sampleTestCases,
        };
      });

      return {
        contest: {
          id: foundContest.id,
          code: foundContest.code,
          title: foundContest.title,
          description: foundContest.description,
          coverImageUrl: foundContest.coverImageUrl,
          startTime: foundContest.startTime,
          endTime: foundContest.endTime,
          totalTime: foundContest.totalTime,
          duration: foundContest.duration,
          isActive: foundContest.isActive,
          totalQuestions: foundContest.totalQuestions,
          totalScore: foundContest.totalScore,
          questions,
        },
        questions,
        participation,
      };
    }),

  // Register / Join contest cover page
  join: protectedProcedure
    .input(z.object({ contestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const targetContest = await ctx.db.query.contest.findFirst({
        where: eq(contest.id, input.contestId),
      });

      if (!targetContest) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Contest not found." });
      }

      const existing = await ctx.db.query.contestParticipation.findFirst({
        where: and(
          eq(contestParticipation.contestId, input.contestId),
          eq(contestParticipation.userId, ctx.user.id)
        ),
      });

      if (existing) return existing;

      const [newParticipation] = await ctx.db
        .insert(contestParticipation)
        .values({
          id: crypto.randomUUID(),
          contestId: input.contestId,
          userId: ctx.user.id,
          joinedAt: new Date(),
          score: 0,
          rank: null as any,
        })
        .returning();

      return newParticipation;
    }),

  // Start the contest attempt (timer starts ticking)
  startAttempt: protectedProcedure
    .input(z.object({ contestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const participation = await ctx.db.query.contestParticipation.findFirst({
        where: and(
          eq(contestParticipation.contestId, input.contestId),
          eq(contestParticipation.userId, ctx.user.id)
        ),
      });

      if (!participation) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You must join the contest first." });
      }

      if (participation.startedAt) return participation;

      const [updated] = await ctx.db
        .update(contestParticipation)
        .set({ startedAt: new Date() })
        .where(eq(contestParticipation.id, participation.id))
        .returning();

      return updated;
    }),

  // Save student response to MCQ or Text question
  submitMcqOrTextAnswer: protectedProcedure
    .input(z.object({
      contestId: z.string(),
      contestQuestionId: z.string().optional(),
      questionId: z.string().optional(),
      userAnswer: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const participation = await ctx.db.query.contestParticipation.findFirst({
        where: and(
          eq(contestParticipation.contestId, input.contestId),
          eq(contestParticipation.userId, ctx.user.id)
        ),
      });

      if (!participation || participation.finishedAt) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Attempt is not active." });
      }

      const cq = await resolveContestQuestion(
        ctx.db,
        input.contestId,
        input.contestQuestionId ?? input.questionId
      );

      const content = getVersionContent(cq.version);

      let status = "Incorrect";
      let scoreObtained = 0;

      if (cq.question.questionType === "mcq") {
        const correctOpt = (content.options as MCQOption[] | null)?.find(
          (o) => o.id === content.correctOptionId
        );
        const isMatch =
          content.correctOptionId === input.userAnswer ||
          (correctOpt && correctOpt.text === input.userAnswer);

        if (isMatch) {
          status = "Correct";
          scoreObtained = cq.marks;
        }
      } else if (cq.question.questionType === "text") {
        const isMatch =
          (content.correctOptionId ?? "").trim().toLowerCase() ===
          input.userAnswer.trim().toLowerCase();
        if (isMatch) {
          status = "Correct";
          scoreObtained = cq.marks;
        }
      } else {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Question type is not MCQ or Text." });
      }

      // Upsert — only keep last submission for MCQ/Text
      const existing = await ctx.db.query.submission.findFirst({
        where: and(
          eq(submission.contestParticipationId, participation.id),
          eq(submission.contestQuestionId, cq.id)
        ),
      });

      if (existing) {
        const [updated] = await ctx.db
          .update(submission)
          .set({ userAnswer: input.userAnswer, status, scoreObtained, createdAt: new Date() })
          .where(eq(submission.id, existing.id))
          .returning();
        return updated;
      }

      const [newSub] = await ctx.db
        .insert(submission)
        .values({
          id: crypto.randomUUID(),
          contestParticipationId: participation.id,
          contestQuestionId: cq.id,
          questionId: cq.question.id,
          userId: ctx.user.id,
          userAnswer: input.userAnswer,
          status,
          scoreObtained,
        })
        .returning();
      return newSub;
    }),

  // Run code against sample test cases (not graded)
  runCode: protectedProcedure
    .input(z.object({
      contestId: z.string(),
      contestQuestionId: z.string().optional(),
      questionId: z.string().optional(),
      sourceCode: z.string(),
      languageId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const participation = await ctx.db.query.contestParticipation.findFirst({
        where: and(
          eq(contestParticipation.contestId, input.contestId),
          eq(contestParticipation.userId, ctx.user.id)
        ),
      });

      if (!participation || participation.finishedAt) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Attempt is not active." });
      }

      const cq = await resolveContestQuestion(
        ctx.db,
        input.contestId,
        input.contestQuestionId ?? input.questionId
      );

      const content = getVersionContent(cq.version);
      const sampleTestCases = (content.testCases ?? []).filter((tc) => tc.isSample);

      if (sampleTestCases.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No sample test cases configured." });
      }

      const results = await Promise.all(
        sampleTestCases.map(async (tc) => {
          const runResult = await executeSubmission({
            source_code: input.sourceCode,
            language_id: input.languageId,
            stdin: tc.input,
            expected_output: tc.expectedOutput,
            cpu_time_limit: content.timeLimit,
            memory_limit: content.memoryLimit,
          });
          return {
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            stdout: runResult.stdout,
            stderr: runResult.stderr,
            compile_output: runResult.compile_output,
            time: runResult.time,
            memory: runResult.memory,
            status: runResult.status,
            passed: checkOutputsMatch(runResult.stdout, tc.expectedOutput),
          };
        })
      );

      return { results };
    }),

  // Submit code against all test cases (official graded submission)
  submitCode: protectedProcedure
    .input(z.object({
      contestId: z.string(),
      contestQuestionId: z.string().optional(),
      questionId: z.string().optional(),
      sourceCode: z.string(),
      languageId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const participation = await ctx.db.query.contestParticipation.findFirst({
        where: and(
          eq(contestParticipation.contestId, input.contestId),
          eq(contestParticipation.userId, ctx.user.id)
        ),
      });

      if (!participation || participation.finishedAt) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Attempt is not active." });
      }

      const cq = await resolveContestQuestion(
        ctx.db,
        input.contestId,
        input.contestQuestionId ?? input.questionId
      );

      const content = getVersionContent(cq.version);
      const allTestCases = content.testCases ?? [];

      if (allTestCases.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No test cases configured." });
      }

      const results = await Promise.all(
        allTestCases.map(async (tc) => {
          const runResult = await executeSubmission({
            source_code: input.sourceCode,
            language_id: input.languageId,
            stdin: tc.input,
            expected_output: tc.expectedOutput,
            cpu_time_limit: content.timeLimit,
            memory_limit: content.memoryLimit,
          });
          return {
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            stdout: runResult.stdout,
            stderr: runResult.stderr,
            compile_output: runResult.compile_output,
            time: runResult.time,
            memory: runResult.memory,
            status: runResult.status,
            passed: checkOutputsMatch(runResult.stdout, tc.expectedOutput),
            isSample: tc.isSample,
          };
        })
      );

      let finalStatus = "Accepted";
      let passedCount = 0;
      let compileError = false;
      let runtimeError = false;
      let timeLimitExceeded = false;

      results.forEach((r) => {
        if (r.passed) passedCount++;
        if (r.status.id === 6) compileError = true;
        else if (r.status.id === 5) timeLimitExceeded = true;
        else if (r.status.id >= 7 && r.status.id <= 12) runtimeError = true;
      });

      if (compileError) finalStatus = "Compilation Error";
      else if (timeLimitExceeded) finalStatus = "Time Limit Exceeded";
      else if (runtimeError) finalStatus = "Runtime Error";
      else if (passedCount < allTestCases.length) finalStatus = "Wrong Answer";

      const scoreObtained = Math.round((passedCount / allTestCases.length) * cq.marks);

      const [newSubmission] = await ctx.db
        .insert(submission)
        .values({
          id: crypto.randomUUID(),
          contestParticipationId: participation.id,
          contestQuestionId: cq.id,
          questionId: cq.question.id,
          userId: ctx.user.id,
          userAnswer: input.sourceCode,
          languageId: input.languageId,
          status: finalStatus,
          scoreObtained,
          executionResult: {
            passedCount,
            totalCount: allTestCases.length,
            details: results.map((r) => ({
              passed: r.passed,
              time: r.time,
              memory: r.memory,
              status: r.status,
              isSample: r.isSample,
              stdout: r.isSample ? r.stdout : null,
              stderr: r.isSample ? r.stderr : null,
              compile_output: r.compile_output,
            })),
          },
        })
        .returning();

      return newSubmission;
    }),

  // Finish the contest (compute final score from best submissions)
  finishAttempt: protectedProcedure
    .input(z.object({ contestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const participation = await ctx.db.query.contestParticipation.findFirst({
        where: and(
          eq(contestParticipation.contestId, input.contestId),
          eq(contestParticipation.userId, ctx.user.id)
        ),
      });

      if (!participation) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Participation record not found." });
      }

      if (participation.finishedAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Contest already submitted." });
      }

      const contestQuestions = await ctx.db.query.contestQuestion.findMany({
        where: eq(contestQuestion.contestId, input.contestId),
      });

      const userSubmissions = await ctx.db.query.submission.findMany({
        where: and(
          eq(submission.contestParticipationId, participation.id),
          eq(submission.userId, ctx.user.id)
        ),
      });

      let totalScore = 0;
      contestQuestions.forEach((cq) => {
        const cqSubs = userSubmissions.filter((s) => s.contestQuestionId === cq.id);
        if (cqSubs.length > 0) {
          totalScore += Math.max(...cqSubs.map((s) => s.scoreObtained));
        }
      });

      const [updated] = await ctx.db
        .update(contestParticipation)
        .set({ finishedAt: new Date(), score: totalScore })
        .where(eq(contestParticipation.id, participation.id))
        .returning();

      const allParticipations = await ctx.db.query.contestParticipation.findMany({
        where: eq(contestParticipation.contestId, input.contestId),
        orderBy: (p, { desc }) => [desc(p.score), p.startedAt],
      });

      for (let i = 0; i < allParticipations.length; i++) {
        await ctx.db
          .update(contestParticipation)
          .set({ rank: i + 1 })
          .where(eq(contestParticipation.id, allParticipations[i].id));
      }

      const finalRank = allParticipations.findIndex((p) => p.id === participation.id) + 1;
      return { ...updated, rank: finalRank };
    }),

  // Get student contest results / leaderboard
  getResults: protectedProcedure
    .input(z.object({ contestId: z.string() }))
    .query(async ({ ctx, input }) => {
      const foundContest = await ctx.db.query.contest.findFirst({
        where: eq(contest.id, input.contestId),
      });

      if (!foundContest) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Contest not found." });
      }

      const participation = await ctx.db.query.contestParticipation.findFirst({
        where: and(
          eq(contestParticipation.contestId, input.contestId),
          eq(contestParticipation.userId, ctx.user.id)
        ),
      });

      if (!participation) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You did not participate in this contest." });
      }

      const leaderboard = await ctx.db.query.contestParticipation.findMany({
        where: eq(contestParticipation.contestId, input.contestId),
        with: { user: { columns: { name: true, email: true } } },
        orderBy: (p, { desc }) => [desc(p.score)],
        limit: 10,
      });

      return { contest: foundContest, participation, leaderboard };
    }),

  // ─── Admin Endpoints ──────────────────────────────────────────────────────

  // List all contests for admin, creator, reviewer
  listAll: creatorOrReviewerProcedure.query(async ({ ctx }) => {
    return ctx.db.query.contest.findMany({
      orderBy: (c, { desc }) => [desc(c.createdAt)],
    });
  }),

  // Create contest
  create: adminProcedure
    .input(z.object({
      code: z.string().min(1),
      title: z.string().min(1),
      description: z.string().optional(),
      coverImageUrl: z.string().optional(),
      startTime: z.coerce.date(),
      endTime: z.coerce.date(),
      totalTime: z.number().min(1),
      isActive: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const [newContest] = await ctx.db
        .insert(contest)
        .values({
          ...input,
          id: crypto.randomUUID(),
          createdById: ctx.user.id,
          totalQuestions: 0,
          totalScore: 0,
          duration: input.totalTime,
        })
        .returning();
      return newContest;
    }),

  // Get contest details for admin editing
  getForEdit: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const found = await ctx.db.query.contest.findFirst({
        where: eq(contest.id, input.id),
        with: {
          contestQuestions: {
            orderBy: (cq, { asc }) => [asc(cq.questionOrder)],
            with: {
              version: true,
              question: {
                columns: { id: true, questionType: true, difficulty: true, status: true },
              },
            },
          },
        },
      });

      if (!found) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Contest not found." });
      }

      const questions = found.contestQuestions.map((cq) => {
        const content = getVersionContent(cq.version);
        const optionsList = content.options
          ? content.options.map((opt) => (typeof opt === "string" ? opt : opt.text))
          : null;

        return {
          id: cq.id,
          contestQuestionId: cq.id,
          questionId: cq.question.id,
          questionType: cq.question.questionType,
          difficulty: cq.question.difficulty,
          status: cq.question.status,
          questionOrder: cq.questionOrder,
          questionScore: cq.marks,
          marks: cq.marks,
          title: content.title,
          questionText: content.title,
          description: content.description,
          options: optionsList,
          structuredOptions: content.options,
          correctOption: content.correctOptionId,
          hint: content.hint,
          starterCode: content.starterCode,
          allowedLanguages: content.allowedLanguages,
          timeLimit: content.timeLimit,
          memoryLimit: content.memoryLimit,
          testCases: content.testCases,
          version: cq.version.version,
        };
      });

      return {
        ...found,
        questions,
      };
    }),

  // Add an APPROVED question (by version snapshot) to a contest
  addQuestion: adminProcedure
    .input(z.object({
      contestId: z.string(),
      questionId: z.string(),
      marks: z.number().min(1).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.transaction(async (tx) => {
        const targetQuestion = await tx.query.question.findFirst({
          where: eq(question.id, input.questionId),
        });

        if (!targetQuestion) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Question not found." });
        }

        if (targetQuestion.status !== "APPROVED") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Only APPROVED questions can be added to a contest.",
          });
        }

        if (!targetQuestion.currentVersionId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Question has no approved version snapshot.",
          });
        }

        const version = await tx.query.questionVersion.findFirst({
          where: eq(questionVersion.id, targetQuestion.currentVersionId),
        });

        if (!version) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Question version not found." });
        }

        const existingCQs = await tx.query.contestQuestion.findMany({
          where: eq(contestQuestion.contestId, input.contestId),
        });

        const marks = input.marks ?? version.questionScore;
        const nextOrder = existingCQs.length + 1;

        await tx.insert(contestQuestion).values({
          id: crypto.randomUUID(),
          contestId: input.contestId,
          questionId: input.questionId,
          questionVersionId: version.id,
          marks,
          questionOrder: nextOrder,
        });

        const newTotalScore = existingCQs.reduce((sum, cq) => sum + cq.marks, 0) + marks;
        await tx
          .update(contest)
          .set({ totalQuestions: nextOrder, totalScore: newTotalScore })
          .where(eq(contest.id, input.contestId));

        await tx.insert(auditLog).values({
          id: crypto.randomUUID(),
          userId: ctx.user.id,
          action: "CONTEST_QUESTION_ADDED",
          entityType: "contest",
          entityId: input.contestId,
          metadata: { questionId: input.questionId, versionId: version.id, marks },
        });

        return { success: true };
      });
    }),

  // Remove a question from a contest
  removeQuestion: adminProcedure
    .input(z.object({ contestQuestionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.transaction(async (tx) => {
        const cq = await tx.query.contestQuestion.findFirst({
          where: eq(contestQuestion.id, input.contestQuestionId),
        });

        if (!cq) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Contest question not found." });
        }

        await tx.delete(contestQuestion).where(eq(contestQuestion.id, input.contestQuestionId));

        const remaining = await tx.query.contestQuestion.findMany({
          where: eq(contestQuestion.contestId, cq.contestId),
          orderBy: (cq, { asc }) => [asc(cq.questionOrder)],
        });

        for (let i = 0; i < remaining.length; i++) {
          await tx
            .update(contestQuestion)
            .set({ questionOrder: i + 1 })
            .where(eq(contestQuestion.id, remaining[i].id));
        }

        const newTotalScore = remaining.reduce((sum, cq) => sum + cq.marks, 0);
        await tx
          .update(contest)
          .set({ totalQuestions: remaining.length, totalScore: newTotalScore })
          .where(eq(contest.id, cq.contestId));

        await tx.insert(auditLog).values({
          id: crypto.randomUUID(),
          userId: ctx.user.id,
          action: "CONTEST_QUESTION_REMOVED",
          entityType: "contest",
          entityId: cq.contestId,
          metadata: { contestQuestionId: input.contestQuestionId, questionId: cq.questionId },
        });

        return { success: true };
      });
    }),

  // Alias for backward compatibility with contest edit page
  deleteQuestion: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.transaction(async (tx) => {
        let cq = await tx.query.contestQuestion.findFirst({
          where: eq(contestQuestion.id, input.id),
        });
        if (!cq) {
          cq = await tx.query.contestQuestion.findFirst({
            where: eq(contestQuestion.questionId, input.id),
          });
        }

        if (!cq) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Contest question not found." });
        }

        await tx.delete(contestQuestion).where(eq(contestQuestion.id, cq.id));

        const remaining = await tx.query.contestQuestion.findMany({
          where: eq(contestQuestion.contestId, cq.contestId),
          orderBy: (cq, { asc }) => [asc(cq.questionOrder)],
        });

        for (let i = 0; i < remaining.length; i++) {
          await tx
            .update(contestQuestion)
            .set({ questionOrder: i + 1 })
            .where(eq(contestQuestion.id, remaining[i].id));
        }

        const newTotalScore = remaining.reduce((sum, item) => sum + item.marks, 0);
        await tx
          .update(contest)
          .set({ totalQuestions: remaining.length, totalScore: newTotalScore })
          .where(eq(contest.id, cq.contestId));

        await tx.insert(auditLog).values({
          id: crypto.randomUUID(),
          userId: ctx.user.id,
          action: "CONTEST_QUESTION_REMOVED",
          entityType: "contest",
          entityId: cq.contestId,
          metadata: { contestQuestionId: cq.id, questionId: cq.questionId },
        });

        return { success: true };
      });
    }),

  // Update contest question (marks/order)
  updateQuestion: adminProcedure
    .input(z.object({
      id: z.string(),
      marks: z.number().optional(),
      questionOrder: z.number().optional(),
      questionText: z.string().optional(),
      questionScore: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.transaction(async (tx) => {
        let cq = await tx.query.contestQuestion.findFirst({
          where: eq(contestQuestion.id, input.id),
        });
        if (!cq) {
          cq = await tx.query.contestQuestion.findFirst({
            where: eq(contestQuestion.questionId, input.id),
          });
        }

        if (!cq) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Contest question not found." });
        }

        const effectiveMarks = input.marks ?? input.questionScore;
        const updateData: Record<string, any> = {};
        if (effectiveMarks !== undefined) updateData.marks = effectiveMarks;
        if (input.questionOrder !== undefined) updateData.questionOrder = input.questionOrder;

        const [updated] = await tx
          .update(contestQuestion)
          .set(updateData)
          .where(eq(contestQuestion.id, cq.id))
          .returning();

        const allCQs = await tx.query.contestQuestion.findMany({
          where: eq(contestQuestion.contestId, cq.contestId),
        });
        const totalScore = allCQs.reduce((sum, item) => sum + item.marks, 0);
        await tx
          .update(contest)
          .set({ totalScore })
          .where(eq(contest.id, cq.contestId));

        return updated;
      });
    }),

  // Update contest metadata
  update: adminProcedure
    .input(z.object({
      id: z.string().min(1),
      code: z.string().min(1),
      title: z.string().min(1),
      description: z.string().optional().nullable(),
      coverImageUrl: z.string().optional().nullable(),
      startTime: z.coerce.date(),
      endTime: z.coerce.date(),
      totalTime: z.number().min(1),
      isActive: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;

      const existing = await ctx.db.query.contest.findFirst({
        where: and(
          eq(contest.code, updateData.code.trim().toUpperCase()),
          ne(contest.id, id)
        ),
      });

      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "A contest with this code already exists." });
      }

      const [updatedContest] = await ctx.db
        .update(contest)
        .set({
          ...updateData,
          code: updateData.code.trim().toUpperCase(),
          duration: updateData.totalTime,
        })
        .where(eq(contest.id, id))
        .returning();

      return updatedContest;
    }),
});