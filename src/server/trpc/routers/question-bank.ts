import {
  createTRPCRouter,
  creatorProcedure,
  reviewerProcedure,
  creatorOrReviewerProcedure,
  adminProcedure,
  getUserRoles,
} from "../init";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, or, inArray, desc, asc, sql, ilike } from "drizzle-orm";
import {
  question,
  questionVersion,
  questionAssignment,
  reviewComment,
  category,
  topic,
} from "@/server/db/question-bank-schema";
import { auditLog } from "@/server/db/audit-schema";
import { user } from "@/server/db/auth-schema";

// ─── Schemas ─────────────────────────────────────────────────────────────────

const mcqOptionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
});

const testCaseSchema = z.object({
  input: z.string(),
  expectedOutput: z.string(),
  isSample: z.boolean().default(false),
});

const questionDraftSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  options: z.array(mcqOptionSchema).optional().nullable(),
  correctOptionId: z.string().optional().nullable(),
  hint: z.string().optional().nullable(),
  questionScore: z.number().min(1).default(10),
  starterCode: z.record(z.string(), z.string()).optional().nullable(),
  allowedLanguages: z.array(z.number()).optional().nullable(),
  timeLimit: z.number().min(1).max(60).default(5),
  memoryLimit: z.number().min(1000).default(128000),
  testCases: z.array(testCaseSchema).optional().nullable(),
});

type QuestionDraftContent = z.infer<typeof questionDraftSchema>;

/**
 * Validates question draft content before snapshot minting or review submission.
 * Enforces title, description, and question-type specific structural requirements
 * (MCQ: >=2 options with unique IDs, correctOptionId matching an option, non-empty text;
 *  Code: >=1 test case with valid input & expected output).
 * Called by: submitForReview and directApproveDraft.
 * Assumed by: questionVersion snapshot creation and Contest question picker downstream.
 */
function validateQuestionDraft(draft: QuestionDraftContent, questionType: string): void {
  if (!draft?.title?.trim()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Title is required." });
  }
  if (!draft?.description?.trim()) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Description is required.",
    });
  }

  if (questionType === "mcq") {
    if (!draft.options || draft.options.length < 2) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "MCQ question must have at least 2 options.",
      });
    }
    // Validate option IDs are unique to prevent ambiguous scoring downstream
    const ids = draft.options.map((o) => o.id);
    if (new Set(ids).size !== ids.length) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "MCQ option IDs must be unique.",
      });
    }
    // Validate option text is non-empty
    if (draft.options.some((o) => !o.text?.trim())) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "All MCQ options must have non-empty text.",
      });
    }
    if (!draft.correctOptionId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "MCQ question must have a correct option specified.",
      });
    }
    // Validate correctOptionId exists in options list
    if (!draft.options.some((o) => o.id === draft.correctOptionId)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "correctOptionId must match one of the defined options.",
      });
    }
  } else if (questionType === "code") {
    if (!draft.testCases || draft.testCases.length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Code question must have at least one test case.",
      });
    }
  }
}

export const questionBankRouter = createTRPCRouter({
  // ─── Creator Endpoints ────────────────────────────────────────────────────

  // Create a new question as DRAFT
  create: creatorProcedure
    .input(
      z.object({
        questionType: z.enum(["mcq", "text", "code"]),
        categoryId: z.string().optional().nullable(),
        topicId: z.string().optional().nullable(),
        difficulty: z.enum(["easy", "medium", "hard"]),
        draft: questionDraftSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const questionId = crypto.randomUUID();

      const [newQuestion] = await ctx.db
        .insert(question)
        .values({
          id: questionId,
          questionType: input.questionType,
          categoryId: input.categoryId ?? null,
          topicId: input.topicId ?? null,
          difficulty: input.difficulty,
          status: "DRAFT",
          currentVersionId: null,
          currentDraft: input.draft,
          createdById: ctx.user.id,
        })
        .returning();

      await ctx.db.insert(auditLog).values({
        id: crypto.randomUUID(),
        userId: ctx.user.id,
        action: "QUESTION_CREATED",
        entityType: "question",
        entityId: questionId,
        metadata: {
          questionType: input.questionType,
          difficulty: input.difficulty,
          title: input.draft.title,
        },
      });

      return newQuestion;
    }),

  // Update working draft (only allowed when status is DRAFT or CHANGES_REQUESTED)
  updateDraft: creatorProcedure
    .input(
      z.object({
        id: z.string(),
        categoryId: z.string().optional().nullable(),
        topicId: z.string().optional().nullable(),
        difficulty: z.enum(["easy", "medium", "hard"]).optional(),
        draft: questionDraftSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const target = await ctx.db.query.question.findFirst({
        where: eq(question.id, input.id),
      });

      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Question not found." });
      }

      if (target.createdById !== ctx.user.id && !ctx.roles.includes("admin")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to edit this question.",
        });
      }

      if (target.status !== "DRAFT" && target.status !== "CHANGES_REQUESTED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot edit draft when question is in ${target.status} status.`,
        });
      }

      const updateData: Record<string, any> = {
        currentDraft: input.draft,
        updatedAt: new Date(),
      };

      if (input.categoryId !== undefined) updateData.categoryId = input.categoryId;
      if (input.topicId !== undefined) updateData.topicId = input.topicId;
      if (input.difficulty !== undefined) updateData.difficulty = input.difficulty;

      const [updated] = await ctx.db
        .update(question)
        .set(updateData)
        .where(eq(question.id, input.id))
        .returning();

      return updated;
    }),

  // Submit draft for review (mints immutable questionVersion, creates assignment)
  submitForReview: creatorProcedure
    .input(
      z.object({
        questionId: z.string(),
        reviewerId: z.string(),
        comment: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.transaction(async (tx) => {
        const target = await tx.query.question.findFirst({
          where: eq(question.id, input.questionId),
        });

        if (!target) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Question not found." });
        }

        if (target.createdById !== ctx.user.id && !ctx.roles.includes("admin")) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You can only submit your own questions.",
          });
        }

        if (target.status !== "DRAFT" && target.status !== "CHANGES_REQUESTED") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Question cannot be submitted for review from status ${target.status}.`,
          });
        }

        // Verify target reviewer exists and has reviewer role
        const targetReviewer = await tx.query.user.findFirst({
          where: eq(user.id, input.reviewerId),
        });

        if (!targetReviewer || targetReviewer.status === "INACTIVE") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Reviewer not found or inactive." });
        }

        const reviewerRoles = getUserRoles(targetReviewer);
        if (!reviewerRoles.includes("reviewer") && !reviewerRoles.includes("admin")) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Selected user does not have the reviewer role.",
          });
        }

        const draft = target.currentDraft as QuestionDraftContent;

        // Content validation via shared validator
        validateQuestionDraft(draft, target.questionType);

        // Determine next version number
        const lastVersions = await tx.query.questionVersion.findMany({
          where: eq(questionVersion.questionId, target.id),
          orderBy: (qv, { desc }) => [desc(qv.version)],
          limit: 1,
        });
        const nextVersionNumber = (lastVersions[0]?.version ?? 0) + 1;

        // Create immutable questionVersion snapshot
        const versionId = crypto.randomUUID();
        await tx.insert(questionVersion).values({
          id: versionId,
          questionId: target.id,
          version: nextVersionNumber,
          title: draft.title,
          description: draft.description,
          options: draft.options ?? null,
          correctOptionId: draft.correctOptionId ?? null,
          hint: draft.hint ?? null,
          questionScore: draft.questionScore ?? 10,
          starterCode: draft.starterCode ?? null,
          allowedLanguages: draft.allowedLanguages ?? null,
          timeLimit: draft.timeLimit ?? 5,
          memoryLimit: draft.memoryLimit ?? 128000,
          testCases: draft.testCases ?? null,
          createdById: ctx.user.id,
        });

        // Update question status and currentVersionId
        await tx
          .update(question)
          .set({
            status: "SUBMITTED_FOR_REVIEW",
            currentVersionId: versionId,
            updatedAt: new Date(),
          })
          .where(eq(question.id, target.id));

        // Create questionAssignment
        const assignmentId = crypto.randomUUID();
        await tx.insert(questionAssignment).values({
          id: assignmentId,
          questionId: target.id,
          versionId: versionId,
          reviewerId: input.reviewerId,
          assignedById: ctx.user.id,
          status: "PENDING",
        });

        // Optional creator comment
        if (input.comment?.trim()) {
          await tx.insert(reviewComment).values({
            id: crypto.randomUUID(),
            questionId: target.id,
            assignmentId,
            userId: ctx.user.id,
            message: input.comment.trim(),
          });
        }

        // Audit log
        await tx.insert(auditLog).values({
          id: crypto.randomUUID(),
          userId: ctx.user.id,
          action: "QUESTION_SUBMITTED",
          entityType: "question",
          entityId: target.id,
          metadata: {
            version: nextVersionNumber,
            versionId,
            reviewerId: input.reviewerId,
          },
        });

        return {
          success: true,
          questionId: target.id,
          versionId,
          version: nextVersionNumber,
          assignmentId,
        };
      });
    }),

  // List questions created by current user (or all questions for admins)
  listMyQuestions: creatorProcedure
    .input(
      z.object({
        status: z.string().optional(),
        search: z.string().optional(),
        all: z.boolean().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const isAdmin = ctx.roles.includes("admin");
      const conditions = [];

      if (!isAdmin || input?.all === false) {
        conditions.push(eq(question.createdById, ctx.user.id));
      }

      if (input?.status) {
        conditions.push(eq(question.status, input.status));
      }

      const questions = await ctx.db.query.question.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: (q, { desc }) => [desc(q.updatedAt)],
        with: {
          category: true,
          topic: true,
          currentVersion: true,
          createdBy: { columns: { id: true, name: true, email: true } },
        },
      });

      if (!input?.search || !input.search.trim()) return questions;
      const q = input.search.trim().toLowerCase();
      return questions.filter((item) => {
        const title = (item.currentDraft as any)?.title?.toLowerCase() || item.currentVersion?.title?.toLowerCase() || "";
        const desc = (item.currentDraft as any)?.description?.toLowerCase() || item.currentVersion?.description?.toLowerCase() || "";
        const cat = item.category?.name?.toLowerCase() || "";
        const top = item.topic?.name?.toLowerCase() || "";
        const creator = item.createdBy?.name?.toLowerCase() || item.createdBy?.email?.toLowerCase() || "";
        return title.includes(q) || desc.includes(q) || cat.includes(q) || top.includes(q) || creator.includes(q);
      });
    }),

  // Get question details with draft, version history, assignments, comments
  getQuestion: creatorOrReviewerProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const found = await ctx.db.query.question.findFirst({
        where: eq(question.id, input.id),
        with: {
          category: true,
          topic: true,
          createdBy: { columns: { id: true, name: true, email: true } },
          currentVersion: true,
          versions: {
            orderBy: (v, { desc }) => [desc(v.version)],
          },
          assignments: {
            orderBy: (a, { desc }) => [desc(a.assignedAt)],
            with: {
              reviewer: { columns: { id: true, name: true, email: true } },
              assignedBy: { columns: { id: true, name: true, email: true } },
              version: { columns: { id: true, version: true } },
              comments: {
                orderBy: (c, { asc }) => [asc(c.createdAt)],
                with: {
                  user: { columns: { id: true, name: true, email: true, image: true } },
                },
              },
            },
          },
        },
      });

      if (!found) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Question not found." });
      }

      // Access check: creator, assigned reviewer on any assignment, or admin
      const isCreator = found.createdById === ctx.user.id;
      const isAssignedReviewer = found.assignments.some((a) => a.reviewerId === ctx.user.id);
      const isAdmin = ctx.roles.includes("admin");

      if (!isCreator && !isAssignedReviewer && !isAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to view this question.",
        });
      }

      return found;
    }),

  // ─── Reviewer Endpoints ───────────────────────────────────────────────────

  // List pending and in-review assignments for reviewer (or all for admin)
  listAssigned: reviewerProcedure
    .input(
      z.object({
        status: z.enum(["PENDING", "IN_REVIEW"]).optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const isAdmin = ctx.roles.includes("admin");
      const statusConditions = input?.status
        ? [eq(questionAssignment.status, input.status)]
        : [inArray(questionAssignment.status, ["PENDING", "IN_REVIEW"])];

      const whereConditions = [...statusConditions];
      if (!isAdmin) {
        whereConditions.push(eq(questionAssignment.reviewerId, ctx.user.id));
      }

      return ctx.db.query.questionAssignment.findMany({
        where: and(...whereConditions),
        orderBy: (a, { desc }) => [desc(a.assignedAt)],
        with: {
          question: {
            with: {
              category: true,
              topic: true,
              createdBy: { columns: { id: true, name: true, email: true } },
            },
          },
          version: true,
          assignedBy: { columns: { id: true, name: true, email: true } },
          reviewer: { columns: { id: true, name: true, email: true } },
          comments: {
            orderBy: (c, { asc }) => [asc(c.createdAt)],
            with: {
              user: { columns: { id: true, name: true, email: true, image: true } },
            },
          },
        },
      });
    }),

  // List reviewer history (completed reviews - or all for admin)
  listHistory: reviewerProcedure.query(async ({ ctx }) => {
    const isAdmin = ctx.roles.includes("admin");
    const whereConditions = [
      inArray(questionAssignment.status, ["COMPLETED", "CANCELLED"]),
    ];
    if (!isAdmin) {
      whereConditions.push(eq(questionAssignment.reviewerId, ctx.user.id));
    }

    const assignments = await ctx.db.query.questionAssignment.findMany({
      where: and(...whereConditions),
      orderBy: (a, { desc }) => [desc(a.completedAt ?? a.assignedAt)],
      with: {
        question: {
          with: {
            category: true,
            topic: true,
            createdBy: { columns: { id: true, name: true, email: true } },
          },
        },
        version: true,
        assignedBy: { columns: { id: true, name: true, email: true } },
        reviewer: { columns: { id: true, name: true, email: true } },
        comments: {
          orderBy: (c, { asc }) => [asc(c.createdAt)],
          with: {
            user: { columns: { id: true, name: true, email: true, image: true } },
          },
        },
      },
    });

    // Deduplicate by questionId so each question only appears once in history, showing its latest review record
    const seen = new Set<string>();
    const deduplicated = [];
    for (const a of assignments) {
      if (!seen.has(a.questionId)) {
        seen.add(a.questionId);
        deduplicated.push(a);
      }
    }
    return deduplicated;
  }),

  // Atomic pickup for review (transitions PENDING -> IN_REVIEW)
  pickUpForReview: reviewerProcedure
    .input(z.object({ assignmentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.transaction(async (tx) => {
        const isAdmin = ctx.roles.includes("admin");
        const whereConditions = [
          eq(questionAssignment.id, input.assignmentId),
          eq(questionAssignment.status, "PENDING"),
        ];
        if (!isAdmin) {
          whereConditions.push(eq(questionAssignment.reviewerId, ctx.user.id));
        }

        // Atomic update to avoid race condition
        const [updatedAssignment] = await tx
          .update(questionAssignment)
          .set({
            status: "IN_REVIEW",
            ...(isAdmin ? { reviewerId: ctx.user.id } : {}),
          })
          .where(and(...whereConditions))
          .returning();

        if (!updatedAssignment) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Assignment not found, not assigned to you, or already picked up.",
          });
        }

        // Update question status to UNDER_REVIEW
        await tx
          .update(question)
          .set({ status: "UNDER_REVIEW", updatedAt: new Date() })
          .where(eq(question.id, updatedAssignment.questionId));

        await tx.insert(auditLog).values({
          id: crypto.randomUUID(),
          userId: ctx.user.id,
          action: "REVIEW_PICKED_UP",
          entityType: "assignment",
          entityId: updatedAssignment.id,
          metadata: { questionId: updatedAssignment.questionId },
        });

        return updatedAssignment;
      });
    }),

  // Approve question version
  approve: reviewerProcedure
    .input(
      z.object({
        assignmentId: z.string(),
        comment: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.transaction(async (tx) => {
        const assignment = await tx.query.questionAssignment.findFirst({
          where: eq(questionAssignment.id, input.assignmentId),
        });

        if (!assignment) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Assignment not found." });
        }

        if (assignment.reviewerId !== ctx.user.id && !ctx.roles.includes("admin")) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not your review assignment." });
        }

        if (assignment.status !== "IN_REVIEW") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Assignment must be in 'IN_REVIEW' status to approve.",
          });
        }

        // Complete assignment
        await tx
          .update(questionAssignment)
          .set({ status: "COMPLETED", completedAt: new Date() })
          .where(eq(questionAssignment.id, assignment.id));

        // Question becomes APPROVED and ready for contests
        await tx
          .update(question)
          .set({ status: "APPROVED", updatedAt: new Date() })
          .where(eq(question.id, assignment.questionId));

        if (input.comment?.trim()) {
          await tx.insert(reviewComment).values({
            id: crypto.randomUUID(),
            questionId: assignment.questionId,
            assignmentId: assignment.id,
            userId: ctx.user.id,
            message: input.comment.trim(),
          });
        }

        await tx.insert(auditLog).values({
          id: crypto.randomUUID(),
          userId: ctx.user.id,
          action: "REVIEW_APPROVED",
          entityType: "question",
          entityId: assignment.questionId,
          metadata: {
            assignmentId: assignment.id,
            versionId: assignment.versionId,
          },
        });

        return { success: true };
      });
    }),

  // Request changes (sends back to creator)
  requestChanges: reviewerProcedure
    .input(
      z.object({
        assignmentId: z.string(),
        comment: z.string().min(1, "Comment explaining changes requested is required."),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.transaction(async (tx) => {
        const assignment = await tx.query.questionAssignment.findFirst({
          where: eq(questionAssignment.id, input.assignmentId),
        });

        if (!assignment) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Assignment not found." });
        }

        if (assignment.reviewerId !== ctx.user.id && !ctx.roles.includes("admin")) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not your review assignment." });
        }

        if (assignment.status !== "IN_REVIEW") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Assignment must be in 'IN_REVIEW' status.",
          });
        }

        // Insert mandatory reason comment
        await tx.insert(reviewComment).values({
          id: crypto.randomUUID(),
          questionId: assignment.questionId,
          assignmentId: assignment.id,
          userId: ctx.user.id,
          message: input.comment.trim(),
        });

        // Complete assignment
        await tx
          .update(questionAssignment)
          .set({ status: "COMPLETED", completedAt: new Date() })
          .where(eq(questionAssignment.id, assignment.id));

        // Question becomes CHANGES_REQUESTED
        await tx
          .update(question)
          .set({ status: "CHANGES_REQUESTED", updatedAt: new Date() })
          .where(eq(question.id, assignment.questionId));

        await tx.insert(auditLog).values({
          id: crypto.randomUUID(),
          userId: ctx.user.id,
          action: "CHANGES_REQUESTED",
          entityType: "question",
          entityId: assignment.questionId,
          metadata: {
            assignmentId: assignment.id,
            versionId: assignment.versionId,
            comment: input.comment.trim(),
          },
        });

        return { success: true };
      });
    }),

  // Reject question
  reject: reviewerProcedure
    .input(
      z.object({
        assignmentId: z.string(),
        comment: z.string().min(1, "Reason for rejection is required."),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.transaction(async (tx) => {
        const assignment = await tx.query.questionAssignment.findFirst({
          where: eq(questionAssignment.id, input.assignmentId),
        });

        if (!assignment) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Assignment not found." });
        }

        if (assignment.reviewerId !== ctx.user.id && !ctx.roles.includes("admin")) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not your review assignment." });
        }

        if (assignment.status !== "IN_REVIEW") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Assignment must be in 'IN_REVIEW' status to reject.",
          });
        }

        // Insert mandatory rejection reason
        await tx.insert(reviewComment).values({
          id: crypto.randomUUID(),
          questionId: assignment.questionId,
          assignmentId: assignment.id,
          userId: ctx.user.id,
          message: input.comment.trim(),
        });

        await tx
          .update(questionAssignment)
          .set({ status: "COMPLETED", completedAt: new Date() })
          .where(eq(questionAssignment.id, assignment.id));

        await tx
          .update(question)
          .set({ status: "REJECTED", updatedAt: new Date() })
          .where(eq(question.id, assignment.questionId));

        await tx.insert(auditLog).values({
          id: crypto.randomUUID(),
          userId: ctx.user.id,
          action: "REVIEW_REJECTED",
          entityType: "question",
          entityId: assignment.questionId,
          metadata: {
            assignmentId: assignment.id,
            versionId: assignment.versionId,
            comment: input.comment.trim(),
          },
        });

        return { success: true };
      });
    }),

  // Add a threaded comment to an active or past review
  addComment: creatorOrReviewerProcedure
    .input(
      z.object({
        questionId: z.string(),
        assignmentId: z.string(),
        message: z.string().min(1, "Comment message cannot be empty."),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const q = await ctx.db.query.question.findFirst({
        where: eq(question.id, input.questionId),
      });

      if (!q) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Question not found." });
      }

      const assignment = await ctx.db.query.questionAssignment.findFirst({
        where: eq(questionAssignment.id, input.assignmentId),
      });

      if (!assignment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Assignment not found." });
      }

      const isCreator = q.createdById === ctx.user.id;
      const isReviewer = assignment.reviewerId === ctx.user.id;
      const isAdmin = ctx.roles.includes("admin");

      if (!isCreator && !isReviewer && !isAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are neither the creator nor the reviewer for this assignment.",
        });
      }

      const [newComment] = await ctx.db
        .insert(reviewComment)
        .values({
          id: crypto.randomUUID(),
          questionId: input.questionId,
          assignmentId: input.assignmentId,
          userId: ctx.user.id,
          message: input.message.trim(),
        })
        .returning();

      return newComment;
    }),

  // Get comments for a question
  getReviewThread: creatorOrReviewerProcedure
    .input(z.object({ questionId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.reviewComment.findMany({
        where: eq(reviewComment.questionId, input.questionId),
        orderBy: (c, { asc }) => [asc(c.createdAt)],
        with: {
          user: { columns: { id: true, name: true, email: true, image: true } },
        },
      });
    }),

  // ─── Question Bank (Browsing & Adding to Contests) ──────────────────────────

  // List approved questions for contest creators / admins
  listQuestionBank: creatorOrReviewerProcedure
    .input(
      z.object({
        categoryId: z.string().optional().nullable(),
        topicId: z.string().optional().nullable(),
        difficulty: z.enum(["easy", "medium", "hard"]).optional().nullable(),
        questionType: z.enum(["mcq", "text", "code"]).optional().nullable(),
        status: z.string().default("APPROVED"),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(question.status, input.status)];

      if (input.categoryId) conditions.push(eq(question.categoryId, input.categoryId));
      if (input.topicId) conditions.push(eq(question.topicId, input.topicId));
      if (input.difficulty) conditions.push(eq(question.difficulty, input.difficulty));
      if (input.questionType) conditions.push(eq(question.questionType, input.questionType));

      const questions = await ctx.db.query.question.findMany({
        where: and(...conditions),
        orderBy: (q, { desc }) => [desc(q.updatedAt)],
        with: {
          category: true,
          topic: true,
          currentVersion: true,
          createdBy: { columns: { id: true, name: true } },
        },
      });

      if (!input.search || !input.search.trim()) return questions;
      const q = input.search.trim().toLowerCase();
      return questions.filter((item) => {
        const title = item.currentVersion?.title?.toLowerCase() || "";
        const desc = item.currentVersion?.description?.toLowerCase() || "";
        const cat = item.category?.name?.toLowerCase() || "";
        const top = item.topic?.name?.toLowerCase() || "";
        return title.includes(q) || desc.includes(q) || cat.includes(q) || top.includes(q);
      });
    }),

  // List all available reviewers (for creator assignment picker)
  listReviewers: creatorOrReviewerProcedure.query(async ({ ctx }) => {
    const allUsers = await ctx.db.query.user.findMany({
      where: eq(user.status, "ACTIVE"),
      columns: { id: true, name: true, email: true, image: true, roles: true, role: true },
    });

    return allUsers.filter((u) => {
      const roles = getUserRoles(u);
      return roles.includes("reviewer") || roles.includes("admin");
    });
  }),

  // Admin re-assign reviewer
  assignReviewer: adminProcedure
    .input(
      z.object({
        questionId: z.string(),
        reviewerId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.transaction(async (tx) => {
        const q = await tx.query.question.findFirst({
          where: eq(question.id, input.questionId),
        });

        if (!q || !q.currentVersionId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Question not found or has no submitted version snapshot.",
          });
        }

        // Cancel any pending assignment
        await tx
          .update(questionAssignment)
          .set({ status: "CANCELLED", completedAt: new Date() })
          .where(
            and(
              eq(questionAssignment.questionId, input.questionId),
              inArray(questionAssignment.status, ["PENDING", "IN_REVIEW"])
            )
          );

        // Create new assignment
        const assignmentId = crypto.randomUUID();
        await tx.insert(questionAssignment).values({
          id: assignmentId,
          questionId: input.questionId,
          versionId: q.currentVersionId,
          reviewerId: input.reviewerId,
          assignedById: ctx.user.id,
          status: "PENDING",
        });

        await tx
          .update(question)
          .set({ status: "SUBMITTED_FOR_REVIEW", updatedAt: new Date() })
          .where(eq(question.id, input.questionId));

        await tx.insert(auditLog).values({
          id: crypto.randomUUID(),
          userId: ctx.user.id,
          action: "REVIEWER_REASSIGNED",
          entityType: "question",
          entityId: input.questionId,
          metadata: { reviewerId: input.reviewerId, assignmentId },
        });

        return { success: true, assignmentId };
      });
    }),

  // Direct review and approval into Question Bank by Administrator.
  // Mints an immutable questionVersion snapshot and sets question.status = APPROVED.
  // Any active peer-review assignment is cancelled and a completed admin assignment is created.
  directApproveDraft: adminProcedure
    .input(
      z.object({
        questionId: z.string(),
        comment: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.transaction(async (tx) => {
        // 1. Fetch and verify question
        const target = await tx.query.question.findFirst({
          where: eq(question.id, input.questionId),
        });
        if (!target) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Question not found." });
        }
        if (
          !["DRAFT", "CHANGES_REQUESTED", "SUBMITTED_FOR_REVIEW", "UNDER_REVIEW"].includes(
            target.status
          )
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Cannot approve question from current status: ${target.status}.`,
          });
        }

        // 2. Validate draft content (shared function enforces structural completeness)
        const draft = target.currentDraft as QuestionDraftContent;
        if (!draft) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Question does not have any draft content to approve.",
          });
        }
        validateQuestionDraft(draft, target.questionType);

        // 3. Mint immutable version snapshot
        const lastVersions = await tx.query.questionVersion.findMany({
          where: eq(questionVersion.questionId, target.id),
          orderBy: (qv, { desc }) => [desc(qv.version)],
          limit: 1,
        });
        const nextVersionNumber = (lastVersions[0]?.version ?? 0) + 1;
        const versionId = crypto.randomUUID();

        await tx.insert(questionVersion).values({
          id: versionId,
          questionId: target.id,
          version: nextVersionNumber,
          title: draft.title,
          description: draft.description,
          options: draft.options ?? null,
          correctOptionId: draft.correctOptionId ?? null,
          hint: draft.hint ?? null,
          questionScore: draft.questionScore ?? 10,
          starterCode: draft.starterCode ?? null,
          allowedLanguages: draft.allowedLanguages ?? null,
          timeLimit: draft.timeLimit ?? 5,
          memoryLimit: draft.memoryLimit ?? 128000,
          testCases: draft.testCases ?? null,
          createdById: ctx.user.id,
        });

        // 4. Cancel any active assignments (preserves reviewer audit trail without leaving orphan reviews)
        await tx
          .update(questionAssignment)
          .set({ status: "CANCELLED", completedAt: new Date() })
          .where(
            and(
              eq(questionAssignment.questionId, target.id),
              inArray(questionAssignment.status, ["PENDING", "IN_REVIEW"])
            )
          );

        // 5. Create new completed admin assignment
        const assignmentId = crypto.randomUUID();
        await tx.insert(questionAssignment).values({
          id: assignmentId,
          questionId: target.id,
          versionId: versionId,
          reviewerId: ctx.user.id,
          assignedById: target.createdById,
          status: "COMPLETED",
          completedAt: new Date(),
        });

        // 6. Update question status to APPROVED and link currentVersionId
        await tx
          .update(question)
          .set({
            status: "APPROVED",
            currentVersionId: versionId,
            updatedAt: new Date(),
          })
          .where(eq(question.id, target.id));

        // 7. Insert review comment on the new admin assignment for conversation continuity
        await tx.insert(reviewComment).values({
          id: crypto.randomUUID(),
          questionId: target.id,
          assignmentId: assignmentId,
          userId: ctx.user.id,
          message:
            input.comment?.trim() ||
            "Reviewed and approved directly into Question Bank by Administrator.",
        });

        // 8. Audit log for compliance
        await tx.insert(auditLog).values({
          id: crypto.randomUUID(),
          userId: ctx.user.id,
          action: "ADMIN_DIRECT_APPROVED",
          entityType: "question",
          entityId: target.id,
          metadata: { version: nextVersionNumber, versionId, assignmentId },
        });

        return { success: true, versionId, version: nextVersionNumber, assignmentId };
      });
    }),

  // Archive question
  archiveQuestion: adminProcedure
    .input(z.object({ questionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(question)
        .set({ status: "ARCHIVED", updatedAt: new Date() })
        .where(eq(question.id, input.questionId))
        .returning();

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Question not found." });
      }

      await ctx.db.insert(auditLog).values({
        id: crypto.randomUUID(),
        userId: ctx.user.id,
        action: "QUESTION_ARCHIVED",
        entityType: "question",
        entityId: input.questionId,
      });

      return updated;
    }),

  // Get full version history for a question
  getVersionHistory: creatorOrReviewerProcedure
    .input(z.object({ questionId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.questionVersion.findMany({
        where: eq(questionVersion.questionId, input.questionId),
        orderBy: (v, { desc }) => [desc(v.version)],
        with: {
          createdBy: { columns: { id: true, name: true } },
        },
      });
    }),
});
