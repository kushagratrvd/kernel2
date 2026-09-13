import { createTRPCRouter, adminProcedure, getUserRoles } from "../init";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc, ilike, or } from "drizzle-orm";
import { user } from "@/server/db/auth-schema";
import { auditLog } from "@/server/db/audit-schema";

export const adminRouter = createTRPCRouter({
  // List all users with optional filtering
  listUsers: adminProcedure
    .input(
      z.object({
        search: z.string().optional(),
        role: z.string().optional(),
        status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const users = await ctx.db.query.user.findMany({
        orderBy: (u, { desc }) => [desc(u.createdAt)],
      });

      return users
        .map((u) => ({
          ...u,
          roles: getUserRoles(u),
        }))
        .filter((u) => {
          if (input?.status && u.status !== input.status) return false;
          if (input?.role && !u.roles.includes(input.role)) return false;
          if (input?.search) {
            const query = input.search.toLowerCase();
            const matchesName = u.name?.toLowerCase().includes(query);
            const matchesEmail = u.email?.toLowerCase().includes(query);
            if (!matchesName && !matchesEmail) return false;
          }
          return true;
        });
    }),

  // Add role to user
  addRole: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        role: z.enum(["admin", "creator", "reviewer", "student"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.transaction(async (tx) => {
        const targetUser = await tx.query.user.findFirst({
          where: eq(user.id, input.userId),
        });

        if (!targetUser) {
          throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
        }

        const currentRoles = getUserRoles(targetUser);
        if (currentRoles.includes(input.role)) {
          return { success: true, roles: currentRoles };
        }

        const updatedRoles = [...currentRoles, input.role];

        const [updated] = await tx
          .update(user)
          .set({
            roles: updatedRoles,
            role: updatedRoles[0] ?? input.role,
            updatedAt: new Date(),
          })
          .where(eq(user.id, input.userId))
          .returning();

        await tx.insert(auditLog).values({
          id: crypto.randomUUID(),
          userId: ctx.user.id,
          action: "ROLE_ADDED",
          entityType: "user",
          entityId: input.userId,
          metadata: { addedRole: input.role, newRoles: updatedRoles },
        });

        return { success: true, roles: updatedRoles, user: updated };
      });
    }),

  // Remove role from user
  removeRole: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        role: z.enum(["admin", "creator", "reviewer", "student"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.transaction(async (tx) => {
        const targetUser = await tx.query.user.findFirst({
          where: eq(user.id, input.userId),
        });

        if (!targetUser) {
          throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
        }

        const currentRoles = getUserRoles(targetUser);
        const updatedRoles = currentRoles.filter((r) => r !== input.role);

        if (updatedRoles.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "A user must have at least one role.",
          });
        }

        const [updated] = await tx
          .update(user)
          .set({
            roles: updatedRoles,
            role: updatedRoles[0]!,
            updatedAt: new Date(),
          })
          .where(eq(user.id, input.userId))
          .returning();

        await tx.insert(auditLog).values({
          id: crypto.randomUUID(),
          userId: ctx.user.id,
          action: "ROLE_REMOVED",
          entityType: "user",
          entityId: input.userId,
          metadata: { removedRole: input.role, newRoles: updatedRoles },
        });

        return { success: true, roles: updatedRoles, user: updated };
      });
    }),

  // Set user active / inactive status
  setUserStatus: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        status: z.enum(["ACTIVE", "INACTIVE"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id && input.status === "INACTIVE") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot deactivate your own account.",
        });
      }

      const [updated] = await ctx.db
        .update(user)
        .set({
          status: input.status,
          updatedAt: new Date(),
        })
        .where(eq(user.id, input.userId))
        .returning();

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
      }

      await ctx.db.insert(auditLog).values({
        id: crypto.randomUUID(),
        userId: ctx.user.id,
        action: "STATUS_UPDATED",
        entityType: "user",
        entityId: input.userId,
        metadata: { newStatus: input.status },
      });

      return updated;
    }),

  // Get audit log entries
  getAuditLog: adminProcedure
    .input(
      z.object({
        entityType: z.string().optional(),
        entityId: z.string().optional(),
        action: z.string().optional(),
        limit: z.number().default(50),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const conditions: any[] = [];

      if (input?.entityType) conditions.push(eq(auditLog.entityType, input.entityType));
      if (input?.entityId) conditions.push(eq(auditLog.entityId, input.entityId));
      if (input?.action) conditions.push(eq(auditLog.action, input.action));

      return ctx.db.query.auditLog.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: (a, { desc }) => [desc(a.createdAt)],
        limit: input?.limit ?? 50,
      });
    }),
});
