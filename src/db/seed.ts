/**
 * Seed script: Creates a user via Better Auth's server-side API.
 *
 * Usage:  pnpm tsx src/db/seed.ts
 *
 * This temporarily calls auth.api.signUpEmail() server-side,
 * which works even if allowSignUp is false in your config,
 * because the server-side API bypasses that client restriction.
 */
import "dotenv/config";
import { auth } from "../lib/auth";

async function seed() {
  const email = process.argv[2] || "admin@kernel.dev";
  const password = process.argv[3] || "admin1234";
  const name = process.argv[4] || "Admin";

  console.log(`\nCreating user: ${email}`);

  try {
    const result = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name,
      },
    });

    console.log("✅ User created successfully!");
    console.log(`   ID:    ${result.user.id}`);
    console.log(`   Email: ${result.user.email}`);
    console.log(`   Name:  ${result.user.name}\n`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("already exists") || message.includes("unique")) {
      console.log("⚠️  User already exists with that email.\n");
    } else {
      console.error("❌ Failed to create user:", message, "\n");
    }
  }

  process.exit(0);
}

seed();
