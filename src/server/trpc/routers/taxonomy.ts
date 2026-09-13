import { createTRPCRouter, protectedProcedure, adminProcedure } from "../init";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { category, topic, question } from "@/server/db/question-bank-schema";
import { auditLog } from "@/server/db/audit-schema";

export const taxonomyRouter = createTRPCRouter({
  // List all categories along with their topics
  listCategories: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.category.findMany({
      orderBy: (c, { asc }) => [asc(c.name)],
      with: {
        topics: {
          orderBy: (t, { asc }) => [asc(t.name)],
        },
      },
    });
  }),

  // Create new category
  createCategory: adminProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.category.findFirst({
        where: eq(category.name, input.name.trim()),
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Category with this name already exists.",
        });
      }

      const [newCategory] = await ctx.db
        .insert(category)
        .values({
          id: crypto.randomUUID(),
          name: input.name.trim(),
        })
        .returning();

      await ctx.db.insert(auditLog).values({
        id: crypto.randomUUID(),
        userId: ctx.user.id,
        action: "CATEGORY_CREATED",
        entityType: "category",
        entityId: newCategory.id,
        metadata: { name: newCategory.name },
      });

      return newCategory;
    }),

  // Update category name
  updateCategory: adminProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(category)
        .set({ name: input.name.trim() })
        .where(eq(category.id, input.id))
        .returning();

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Category not found." });
      }

      await ctx.db.insert(auditLog).values({
        id: crypto.randomUUID(),
        userId: ctx.user.id,
        action: "CATEGORY_UPDATED",
        entityType: "category",
        entityId: updated.id,
        metadata: { name: updated.name },
      });

      return updated;
    }),

  // Delete category
  deleteCategory: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const linkedQuestions = await ctx.db.query.question.findFirst({
        where: eq(question.categoryId, input.id),
      });

      if (linkedQuestions) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete category with associated questions. Reassign them first.",
        });
      }

      await ctx.db.delete(category).where(eq(category.id, input.id));

      await ctx.db.insert(auditLog).values({
        id: crypto.randomUUID(),
        userId: ctx.user.id,
        action: "CATEGORY_DELETED",
        entityType: "category",
        entityId: input.id,
      });

      return { success: true };
    }),

  // List topics, optionally filtered by category
  listTopics: protectedProcedure
    .input(z.object({ categoryId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      if (input?.categoryId) {
        return ctx.db.query.topic.findMany({
          where: eq(topic.categoryId, input.categoryId),
          orderBy: (t, { asc }) => [asc(t.name)],
        });
      }

      return ctx.db.query.topic.findMany({
        orderBy: (t, { asc }) => [asc(t.name)],
        with: { category: true },
      });
    }),

  // Create topic
  createTopic: adminProcedure
    .input(
      z.object({
        categoryId: z.string(),
        name: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const parentCat = await ctx.db.query.category.findFirst({
        where: eq(category.id, input.categoryId),
      });

      if (!parentCat) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Category not found." });
      }

      const [newTopic] = await ctx.db
        .insert(topic)
        .values({
          id: crypto.randomUUID(),
          categoryId: input.categoryId,
          name: input.name.trim(),
        })
        .returning();

      await ctx.db.insert(auditLog).values({
        id: crypto.randomUUID(),
        userId: ctx.user.id,
        action: "TOPIC_CREATED",
        entityType: "topic",
        entityId: newTopic.id,
        metadata: { categoryId: input.categoryId, name: newTopic.name },
      });

      return newTopic;
    }),

  // Update topic name
  updateTopic: adminProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(topic)
        .set({ name: input.name.trim() })
        .where(eq(topic.id, input.id))
        .returning();

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Topic not found." });
      }

      await ctx.db.insert(auditLog).values({
        id: crypto.randomUUID(),
        userId: ctx.user.id,
        action: "TOPIC_UPDATED",
        entityType: "topic",
        entityId: updated.id,
        metadata: { name: updated.name },
      });

      return updated;
    }),

  // Delete topic
  deleteTopic: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const linkedQuestions = await ctx.db.query.question.findFirst({
        where: eq(question.topicId, input.id),
      });

      if (linkedQuestions) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete topic with associated questions. Reassign them first.",
        });
      }

      await ctx.db.delete(topic).where(eq(topic.id, input.id));

      await ctx.db.insert(auditLog).values({
        id: crypto.randomUUID(),
        userId: ctx.user.id,
        action: "TOPIC_DELETED",
        entityType: "topic",
        entityId: input.id,
      });

      return { success: true };
    }),
});
