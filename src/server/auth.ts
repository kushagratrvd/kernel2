import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin as adminPlugin } from "better-auth/plugins"
import { ac, admin, student } from "@/lib/permissions"
import { db } from "@/server/db"; 

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "pg",
    }),

    emailAndPassword: {
        enabled: true,
        allowSignUp: false,
    },
    plugins: [
        adminPlugin({
            ac,
            roles: {
                admin,
                student,
            }
        }),
        nextCookies()],
});