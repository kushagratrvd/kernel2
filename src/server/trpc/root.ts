import { createCallerFactory, createTRPCRouter } from "@/server/trpc/init";

import { contestRouter } from "./routers/contest";
import { questionBankRouter } from "./routers/question-bank";
import { taxonomyRouter } from "./routers/taxonomy";
import { adminRouter } from "./routers/admin";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  contest: contestRouter,
  questionBank: questionBankRouter,
  taxonomy: taxonomyRouter,
  admin: adminRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);