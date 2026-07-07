import { createTRPCRouter, protectedProcedure, adminProcedure } from "../init";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { contest, contestParticipation, question, testCase, submission } from "@/server/db/contest-schema";
import { executeSubmission, checkOutputsMatch } from "@/server/codebox";

export const contestRouter = createTRPCRouter({
  // Get contest by code (for student cover & attempt pages)
  getByCode: protectedProcedure
    .input(z.object({ code: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const foundContest = await ctx.db.query.contest.findFirst({
        where: eq(contest.code, input.code),
        with: {
          questions: {
            orderBy: (q, { asc }) => [asc(q.questionOrder)],
            with: {
              testCases: {
                // Only return sample test cases to the frontend student view
                where: (tc, { eq }) => eq(tc.isSample, true),
              },
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

      // Check if user has already joined or started
      const participation = await ctx.db.query.contestParticipation.findFirst({
        where: and(
          eq(contestParticipation.contestId, foundContest.id),
          eq(contestParticipation.userId, ctx.user.id)
        ),
        with: {
          submissions: true,
        },
      });

      return {
        contest: foundContest,
        participation,
      };
    }),

  // Register / Join contest cover page
  join: protectedProcedure
    .input(z.object({ contestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify contest exists
      const targetContest = await ctx.db.query.contest.findFirst({
        where: eq(contest.id, input.contestId),
      });

      if (!targetContest) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contest not found.",
        });
      }

      // Check if already registered
      const existing = await ctx.db.query.contestParticipation.findFirst({
        where: and(
          eq(contestParticipation.contestId, input.contestId),
          eq(contestParticipation.userId, ctx.user.id)
        ),
      });

      if (existing) {
        return existing;
      }

      // Create new participation record
      const id = crypto.randomUUID();
      const [newParticipation] = await ctx.db
        .insert(contestParticipation)
        .values({
          id,
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
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You must join the contest first.",
        });
      }

      if (participation.startedAt) {
        return participation; // Already started
      }

      const [updated] = await ctx.db
        .update(contestParticipation)
        .set({
          startedAt: new Date(),
        })
        .where(eq(contestParticipation.id, participation.id))
        .returning();

      return updated;
    }),

  // Save student response to MCQ or Text question
  submitMcqOrTextAnswer: protectedProcedure
    .input(z.object({
      contestId: z.string(),
      questionId: z.string(),
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
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Attempt is not active.",
        });
      }

      const targetQuestion = await ctx.db.query.question.findFirst({
        where: eq(question.id, input.questionId),
      });

      if (!targetQuestion) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Question not found.",
        });
      }

      // Check answer correctness
      let status = "Incorrect";
      let scoreObtained = 0;

      if (targetQuestion.questionType === "mcq") {
        if (targetQuestion.correctOption === input.userAnswer) {
          status = "Correct";
          scoreObtained = targetQuestion.questionScore;
        }
      } else if (targetQuestion.questionType === "text") {
        const isMatch = (targetQuestion.correctOption || "").trim().toLowerCase() === input.userAnswer.trim().toLowerCase();
        if (isMatch) {
          status = "Correct";
          scoreObtained = targetQuestion.questionScore;
        }
      } else {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Question type is not MCQ or Text.",
        });
      }

      // Upsert submission record (only keep last submission for MCQ/Text to avoid clutter)
      const existing = await ctx.db.query.submission.findFirst({
        where: and(
          eq(submission.contestParticipationId, participation.id),
          eq(submission.questionId, input.questionId)
        ),
      });

      if (existing) {
        const [updated] = await ctx.db
          .update(submission)
          .set({
            userAnswer: input.userAnswer,
            status,
            scoreObtained,
            createdAt: new Date(),
          })
          .where(eq(submission.id, existing.id))
          .returning();
        return updated;
      } else {
        const submissionId = crypto.randomUUID();
        const [newSub] = await ctx.db
          .insert(submission)
          .values({
            id: submissionId,
            contestParticipationId: participation.id,
            questionId: input.questionId,
            userId: ctx.user.id,
            userAnswer: input.userAnswer,
            status,
            scoreObtained,
          })
          .returning();
        return newSub;
      }
    }),

  // Run student code against sample test cases (no graded DB write)
  runCode: protectedProcedure
    .input(z.object({
      contestId: z.string(),
      questionId: z.string(),
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
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Attempt is not active.",
        });
      }

      const targetQuestion = await ctx.db.query.question.findFirst({
        where: eq(question.id, input.questionId),
        with: {
          testCases: {
            where: (tc, { eq }) => eq(tc.isSample, true),
          },
        },
      });

      if (!targetQuestion) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Question not found.",
        });
      }

      const sampleTestCases = targetQuestion.testCases;
      if (sampleTestCases.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No sample test cases configured for this problem.",
        });
      }

      // Execute code against sample test cases
      const results = await Promise.all(
        sampleTestCases.map(async (tc) => {
          const runResult = await executeSubmission({
            source_code: input.sourceCode,
            language_id: input.languageId,
            stdin: tc.input,
            expected_output: tc.expectedOutput,
            cpu_time_limit: targetQuestion.timeLimit,
            memory_limit: targetQuestion.memoryLimit,
          });

          const passed = checkOutputsMatch(runResult.stdout, tc.expectedOutput);

          return {
            testCaseId: tc.id,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            stdout: runResult.stdout,
            stderr: runResult.stderr,
            compile_output: runResult.compile_output,
            time: runResult.time,
            memory: runResult.memory,
            status: runResult.status,
            passed,
          };
        })
      );

      return { results };
    }),

  // Submit student code against all test cases (official submission)
  submitCode: protectedProcedure
    .input(z.object({
      contestId: z.string(),
      questionId: z.string(),
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
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Attempt is not active.",
        });
      }

      const targetQuestion = await ctx.db.query.question.findFirst({
        where: eq(question.id, input.questionId),
        with: {
          testCases: true,
        },
      });

      if (!targetQuestion) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Question not found.",
        });
      }

      const allTestCases = targetQuestion.testCases;
      if (allTestCases.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No test cases configured for this problem.",
        });
      }

      // Execute code against all test cases in parallel
      const results = await Promise.all(
        allTestCases.map(async (tc) => {
          const runResult = await executeSubmission({
            source_code: input.sourceCode,
            language_id: input.languageId,
            stdin: tc.input,
            expected_output: tc.expectedOutput,
            cpu_time_limit: targetQuestion.timeLimit,
            memory_limit: targetQuestion.memoryLimit,
          });

          const passed = checkOutputsMatch(runResult.stdout, tc.expectedOutput);

          return {
            testCaseId: tc.id,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            stdout: runResult.stdout,
            stderr: runResult.stderr,
            compile_output: runResult.compile_output,
            time: runResult.time,
            memory: runResult.memory,
            status: runResult.status,
            passed,
            isSample: tc.isSample,
          };
        })
      );

      // Determine final status
      let finalStatus = "Accepted";
      let passedCount = 0;
      let compileError = false;
      let runtimeError = false;
      let timeLimitExceeded = false;

      results.forEach((r) => {
        if (r.passed) {
          passedCount++;
        }
        if (r.status.id === 6) {
          compileError = true;
        } else if (r.status.id === 5) {
          timeLimitExceeded = true;
        } else if (r.status.id >= 7 && r.status.id <= 12) {
          runtimeError = true;
        }
      });

      if (compileError) {
        finalStatus = "Compilation Error";
      } else if (timeLimitExceeded) {
        finalStatus = "Time Limit Exceeded";
      } else if (runtimeError) {
        finalStatus = "Runtime Error";
      } else if (passedCount < allTestCases.length) {
        finalStatus = "Wrong Answer";
      }

      // Calculate score based on passed test cases fraction
      const scoreObtained = Math.round((passedCount / allTestCases.length) * targetQuestion.questionScore);

      // Create submission
      const submissionId = crypto.randomUUID();
      const [newSubmission] = await ctx.db
        .insert(submission)
        .values({
          id: submissionId,
          contestParticipationId: participation.id,
          questionId: input.questionId,
          userId: ctx.user.id,
          userAnswer: input.sourceCode,
          languageId: input.languageId,
          status: finalStatus,
          scoreObtained,
          executionResult: {
            passedCount,
            totalCount: allTestCases.length,
            details: results.map((r) => ({
              testCaseId: r.testCaseId,
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

  // Submit/Finish the contest (computes total score from highest scored submissions)
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
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Participation record not found.",
        });
      }

      if (participation.finishedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Contest already submitted.",
        });
      }

      // 1. Fetch all questions for this contest
      const contestQuestions = await ctx.db.query.question.findMany({
        where: eq(question.contestId, input.contestId),
      });

      // 2. Fetch all submissions by this student for this participation
      const userSubmissions = await ctx.db.query.submission.findMany({
        where: and(
          eq(submission.contestParticipationId, participation.id),
          eq(submission.userId, ctx.user.id)
        ),
      });

      // 3. Compute final score (best submission score per question)
      let totalScore = 0;
      contestQuestions.forEach((q) => {
        const questionSubs = userSubmissions.filter((s) => s.questionId === q.id);
        if (questionSubs.length > 0) {
          const maxScore = Math.max(...questionSubs.map((s) => s.scoreObtained));
          totalScore += maxScore;
        }
      });

      // 4. Update finish time and total score
      const [updated] = await ctx.db
        .update(contestParticipation)
        .set({
          finishedAt: new Date(),
          score: totalScore,
        })
        .where(eq(contestParticipation.id, participation.id))
        .returning();

      // 5. Recalculate ranks for this contest
      const allParticipations = await ctx.db.query.contestParticipation.findMany({
        where: eq(contestParticipation.contestId, input.contestId),
        orderBy: (p, { desc }) => [desc(p.score), p.startedAt],
      });

      // Update rankings in database
      for (let i = 0; i < allParticipations.length; i++) {
        const item = allParticipations[i];
        const newRank = i + 1;
        await ctx.db
          .update(contestParticipation)
          .set({ rank: newRank })
          .where(eq(contestParticipation.id, item.id));
      }

      const finalRank = allParticipations.findIndex((p) => p.id === participation.id) + 1;

      return {
        ...updated,
        rank: finalRank,
      };
    }),

  // Get student contest results/ranking
  getResults: protectedProcedure
    .input(z.object({ contestId: z.string() }))
    .query(async ({ ctx, input }) => {
      const foundContest = await ctx.db.query.contest.findFirst({
        where: eq(contest.id, input.contestId),
      });

      if (!foundContest) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contest not found.",
        });
      }

      const participation = await ctx.db.query.contestParticipation.findFirst({
        where: and(
          eq(contestParticipation.contestId, input.contestId),
          eq(contestParticipation.userId, ctx.user.id)
        ),
      });

      if (!participation) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You did not participate in this contest.",
        });
      }

      // Get leaderboard (top 10)
      const leaderboard = await ctx.db.query.contestParticipation.findMany({
        where: eq(contestParticipation.contestId, input.contestId),
        with: {
          user: {
            columns: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: (p, { desc }) => [desc(p.score)],
        limit: 10,
      });

      return {
        contest: foundContest,
        participation,
        leaderboard,
      };
    }),

  // ================= ADMIN ENDPOINTS =================

  // List all contests for admin
  listAll: adminProcedure.query(async ({ ctx }) => {
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
      const id = crypto.randomUUID();
      const [newContest] = await ctx.db
        .insert(contest)
        .values({
          ...input,
          id,
          createdById: ctx.user.id,
          totalQuestions: 0,
          totalScore: 0,
          duration: input.totalTime,
        })
        .returning();
      return newContest;
    }),

  // Get contest details including questions and test cases for admin editing
  getForEdit: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const found = await ctx.db.query.contest.findFirst({
        where: eq(contest.id, input.id),
        with: {
          questions: {
            orderBy: (q, { asc }) => [asc(q.questionOrder)],
            with: {
              testCases: true,
            },
          },
        },
      });

      if (!found) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contest not found.",
        });
      }

      return found;
    }),

  // Add question to contest
  addQuestion: adminProcedure
    .input(z.object({
      contestId: z.string(),
      questionText: z.string().min(1),
      questionType: z.string(), // "mcq", "text", "code"
      options: z.array(z.string()).optional(),
      correctOption: z.string().optional(),
      questionScore: z.number().min(1),
      starterCode: z.any().optional(),
      allowedLanguages: z.array(z.number()).optional(),
      timeLimit: z.number().optional(),
      memoryLimit: z.number().optional(),
      testCases: z.array(z.object({
        input: z.string(),
        expectedOutput: z.string(),
        isSample: z.boolean(),
      })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const questions = await ctx.db.query.question.findMany({
        where: eq(question.contestId, input.contestId),
      });
      const order = questions.length + 1;
      const questionId = crypto.randomUUID();

      await ctx.db.insert(question).values({
        id: questionId,
        contestId: input.contestId,
        questionText: input.questionText,
        questionType: input.questionType,
        options: input.options || null,
        correctOption: input.correctOption || null,
        questionScore: input.questionScore,
        questionOrder: order,
        starterCode: input.starterCode || null,
        allowedLanguages: input.allowedLanguages || null,
        timeLimit: input.timeLimit ?? 5,
        memoryLimit: input.memoryLimit ?? 128000,
      });

      if (input.questionType === "code" && input.testCases && input.testCases.length > 0) {
        await ctx.db.insert(testCase).values(
          input.testCases.map((tc) => ({
            id: crypto.randomUUID(),
            questionId,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            isSample: tc.isSample,
          }))
        );
      }

      // Update contest totals
      const newTotalScore = questions.reduce((sum, q) => sum + q.questionScore, 0) + input.questionScore;
      await ctx.db
        .update(contest)
        .set({
          totalQuestions: questions.length + 1,
          totalScore: newTotalScore,
        })
        .where(eq(contest.id, input.contestId));

      return { success: true };
    }),

  // Update question
  updateQuestion: adminProcedure
    .input(z.object({
      id: z.string(),
      questionText: z.string().min(1),
      options: z.array(z.string()).optional(),
      correctOption: z.string().optional(),
      questionScore: z.number().min(1),
      starterCode: z.any().optional(),
      allowedLanguages: z.array(z.number()).optional(),
      timeLimit: z.number().optional(),
      memoryLimit: z.number().optional(),
      testCases: z.array(z.object({
        input: z.string(),
        expectedOutput: z.string(),
        isSample: z.boolean(),
      })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const origQuestion = await ctx.db.query.question.findFirst({
        where: eq(question.id, input.id),
      });

      if (!origQuestion) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Question not found.",
        });
      }

      await ctx.db
        .update(question)
        .set({
          questionText: input.questionText,
          options: input.options || null,
          correctOption: input.correctOption || null,
          questionScore: input.questionScore,
          starterCode: input.starterCode || null,
          allowedLanguages: input.allowedLanguages || null,
          timeLimit: input.timeLimit ?? 5,
          memoryLimit: input.memoryLimit ?? 128000,
        })
        .where(eq(question.id, input.id));

      if (origQuestion.questionType === "code" && input.testCases) {
        await ctx.db.delete(testCase).where(eq(testCase.questionId, input.id));
        if (input.testCases.length > 0) {
          await ctx.db.insert(testCase).values(
            input.testCases.map((tc) => ({
              id: crypto.randomUUID(),
              questionId: input.id,
              input: tc.input,
              expectedOutput: tc.expectedOutput,
              isSample: tc.isSample,
            }))
          );
        }
      }

      // Update contest stats
      const allQuestions = await ctx.db.query.question.findMany({
        where: eq(question.contestId, origQuestion.contestId),
      });
      const newTotalScore = allQuestions.reduce((sum, q) => sum + q.questionScore, 0);

      await ctx.db
        .update(contest)
        .set({
          totalScore: newTotalScore,
        })
        .where(eq(contest.id, origQuestion.contestId));

      return { success: true };
    }),

  // Delete question
  deleteQuestion: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const origQuestion = await ctx.db.query.question.findFirst({
        where: eq(question.id, input.id),
      });

      if (!origQuestion) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Question not found.",
        });
      }

      await ctx.db.delete(question).where(eq(question.id, input.id));

      // Re-order questions and compute new stats
      const remainingQuestions = await ctx.db.query.question.findMany({
        where: eq(question.contestId, origQuestion.contestId),
        orderBy: (q, { asc }) => [asc(q.questionOrder)],
      });

      for (let i = 0; i < remainingQuestions.length; i++) {
        await ctx.db
          .update(question)
          .set({ questionOrder: i + 1 })
          .where(eq(question.id, remainingQuestions[i].id));
      }

      const newTotalScore = remainingQuestions.reduce((sum, q) => sum + q.questionScore, 0);
      await ctx.db
        .update(contest)
        .set({
          totalQuestions: remainingQuestions.length,
          totalScore: newTotalScore,
        })
        .where(eq(contest.id, origQuestion.contestId));

      return { success: true };
    }),
});