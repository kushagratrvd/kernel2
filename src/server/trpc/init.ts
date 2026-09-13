/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { type NextRequest } from "next/server";

import { db } from "@/server/db";
import { auth } from "@/server/auth"; 

export function getUserRoles(user: any): string[] {
  if (Array.isArray(user?.roles)) return user.roles;
  if (typeof user?.roles === "string") {
    try {
      const parsed = JSON.parse(user.roles);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [user.roles];
    }
  }
  if (user?.role && typeof user.role === "string") return [user.role];
  return ["student"];
}

/**
 * 1. CONTEXT
 */
export const createTRPCContext = async (opts: { 
  headers: Headers;
  req?: NextRequest;
 }) => {
  const session = await auth.api.getSession({
    headers: opts.headers,
  });

  return {
    db,
    session,
    headers: opts.headers,
  };
};

/**
 * 2. INITIALIZATION
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createCallerFactory = t.createCallerFactory;

/**
 * 3. ROUTER & PROCEDURE
 */
export const createTRPCRouter = t.router;

const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  if (t._config.isDev) {
    const waitMs = Math.floor(Math.random() * 400) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const result = await next();

  const end = Date.now();
  console.log(`[TRPC] ${path} took ${end - start}ms to execute`);

  return result;
});

// Auth Middleware checks if user is logged in and active
const authMiddleware = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to perform this action",
    });
  }

  const user = ctx.session.user as any;
  if (user.banned || user.status === "INACTIVE") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Your account is deactivated or banned",
    });
  }

  return next({
    ctx: {
      session: ctx.session,
      user: ctx.session.user,
      roles: getUserRoles(user),
    },
  });
});

const adminMiddleware = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to perform this action",
    });
  }
  const roles = getUserRoles(ctx.session.user);
  if (!roles.includes("admin")) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You must be an admin to perform this action",
    });
  }
  return next({
    ctx: {
      session: ctx.session,
      user: ctx.session.user,
      roles,
    },
  });
});

const creatorMiddleware = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to perform this action",
    });
  }
  const roles = getUserRoles(ctx.session.user);
  if (!roles.includes("creator") && !roles.includes("admin")) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You must be a creator or admin to perform this action",
    });
  }
  return next({
    ctx: {
      session: ctx.session,
      user: ctx.session.user,
      roles,
    },
  });
});

const reviewerMiddleware = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to perform this action",
    });
  }
  const roles = getUserRoles(ctx.session.user);
  if (!roles.includes("reviewer") && !roles.includes("admin")) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You must be a reviewer or admin to perform this action",
    });
  }
  return next({
    ctx: {
      session: ctx.session,
      user: ctx.session.user,
      roles,
    },
  });
});

const creatorOrReviewerMiddleware = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to perform this action",
    });
  }
  const roles = getUserRoles(ctx.session.user);
  const isAllowed = roles.some((r) => r === "creator" || r === "reviewer" || r === "admin");
  if (!isAllowed) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You must be a creator, reviewer, or admin to perform this action",
    });
  }
  return next({
    ctx: {
      session: ctx.session,
      user: ctx.session.user,
      roles,
    },
  });
});

export const publicProcedure = t.procedure.use(timingMiddleware);

export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(authMiddleware);

export const adminProcedure = t.procedure
  .use(timingMiddleware)
  .use(authMiddleware)
  .use(adminMiddleware);

export const creatorProcedure = t.procedure
  .use(timingMiddleware)
  .use(authMiddleware)
  .use(creatorMiddleware);

export const reviewerProcedure = t.procedure
  .use(timingMiddleware)
  .use(authMiddleware)
  .use(reviewerMiddleware);

export const creatorOrReviewerProcedure = t.procedure
  .use(timingMiddleware)
  .use(authMiddleware)
  .use(creatorOrReviewerMiddleware);
