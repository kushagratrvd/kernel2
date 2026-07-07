import { createTRPCRouter, protectedProcedure } from "../init";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { contest, contestParticipation } from "@/server/db/contest-schema";

export const contestRouter = createTRPCRouter({
  // Get contest by code
  getByCode: protectedProcedure
    .input(z.object({ code: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const foundContest = await ctx.db.query.contest.findFirst({
        where: eq(contest.code, input.code),
        with: {
          questions: {
            orderBy: (q, { asc }) => [asc(q.questionOrder)],
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
          rank: null as any, // Will be computed after/during contest
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

  // Submit/Finish the contest
  finishAttempt: protectedProcedure
    .input(z.object({ contestId: z.string(), score: z.number().min(0) }))
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

      // Update finish time and score
      const [updated] = await ctx.db
        .update(contestParticipation)
        .set({
          finishedAt: new Date(),
          score: input.score,
        })
        .where(eq(contestParticipation.id, participation.id))
        .returning();

      // Recalculate ranks for this contest (simple rankings query)
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

      return {
        ...updated,
        rank: allParticipations.findIndex((p) => p.id === participation.id) + 1,
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
});