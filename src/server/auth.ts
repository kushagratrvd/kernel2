import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin as adminPlugin } from "better-auth/plugins";
import { ac, admin, student, creator, reviewer } from "@/lib/permissions";
import { db } from "@/server/db"; 

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "pg",
    }),

    user: {
        additionalFields: {
            roles: {
                type: "string[]",
                required: false,
                defaultValue: ["student"],
            },
            status: {
                type: "string",
                required: false,
                defaultValue: "ACTIVE",
            },
        },
    },

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
                creator,
                reviewer,
            },
        }),
        nextCookies(),
    ],
});