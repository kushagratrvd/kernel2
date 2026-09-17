import { createTRPCRouter, adminProcedure, getUserRoles } from "../init";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc, ilike, or } from "drizzle-orm";
import { user } from "@/server/db/auth-schema";
import { auditLog } from "@/server/db/audit-schema";
import { auth } from "@/server/auth";

export const adminRouter = createTRPCRouter({
  // Create a new user with specific roles
  createUser: adminProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required"),
        email: z.string().email("Invalid email"),
        password: z.string().min(8, "Password must be at least 8 characters"),
        roles: z.array(z.enum(["admin", "creator", "reviewer", "student"])).min(1, "Select at least one role"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const email = input.email.trim().toLowerCase();
      const existingUser = await ctx.db.query.user.findFirst({
        where: eq(user.email, email),
      });

      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A user with this email address already exists.",
        });
      }

      try {
        const created = await auth.api.createUser({
          body: {
            name: input.name.trim(),
            email,
            password: input.password,
            role: input.roles[0]!,
            data: {
              roles: input.roles,
              status: "ACTIVE",
            },
          },
        });

        // Sync roles in database
        await ctx.db
          .update(user)
          .set({
            roles: input.roles,
            role: input.roles[0]!,
            status: "ACTIVE",
            updatedAt: new Date(),
          })
          .where(eq(user.id, created.user.id));

        await ctx.db.insert(auditLog).values({
          id: crypto.randomUUID(),
          userId: ctx.user.id,
          action: "USER_CREATED",
          entityType: "user",
          entityId: created.user.id,
          metadata: { email, roles: input.roles },
        });

        return { success: true, user: created.user };
      } catch (err: any) {
        console.error("Failed to create user:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err.message || "Failed to create user.",
        });
      }
    }),
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
