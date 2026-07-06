import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./auth-schema";
import { env } from "@/env";

const globalForDb = globalThis as unknown as {
    conn: postgres.Sql | undefined;
};

export const conn = globalForDb.conn ?? postgres(env.DATABASE_URL);
if(env.NODE_ENV !== "production") globalForDb.conn = conn;

export const db = drizzle(conn, { schema });