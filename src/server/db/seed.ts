/**
 * Seed script: Populates the database with test data.
 *
 * Usage: pnpm tsx src/db/seed.ts
 */
import "dotenv/config";
import { auth } from "../auth";
import { db } from "./index";
import { user } from "./auth-schema";
import { contest, question } from "./contest-schema";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("\n🌱 Seeding database...");

  // 1. Create Admin User
  let adminId = "";
  try {
    const adminResult = await auth.api.signUpEmail({
      body: {
        email: "admin@kernel.dev",
        password: "admin1234Password",
        name: "Admin User",
      },
    });
    adminId = adminResult.user.id;
    // Set role to admin
    await db.update(user).set({ role: "admin" }).where(eq(user.id, adminId));
    console.log("✅ Admin user created: admin@kernel.dev (admin1234Password)");
  } catch (err: any) {
    if (err.message?.includes("already exists") || err.message?.includes("unique")) {
      const existing = await db.query.user.findFirst({ where: eq(user.email, "admin@kernel.dev") });
      adminId = existing?.id || "";
      console.log("⚠️  Admin user already exists.");
    } else {
      console.error("❌ Failed to create admin:", err);
    }
  }

  // 2. Create Student User
  let studentId = "";
  try {
    const studentResult = await auth.api.signUpEmail({
      body: {
        email: "student@kernel.dev",
        password: "student1234Password",
        name: "Student User",
      },
    });
    studentId = studentResult.user.id;
    // Set role to student (default is student, but be explicit)
    await db.update(user).set({ role: "student" }).where(eq(user.id, studentId));
    console.log("✅ Student user created: student@kernel.dev (student1234Password)");
  } catch (err: any) {
    if (err.message?.includes("already exists") || err.message?.includes("unique")) {
      const existing = await db.query.user.findFirst({ where: eq(user.email, "student@kernel.dev") });
      studentId = existing?.id || "";
      console.log("⚠️  Student user already exists.");
    } else {
      console.error("❌ Failed to create student:", err);
    }
  }

  // 3. Create a Sample Contest
  if (adminId) {
    const contestId = "test-contest-uuid-1";
    const contestCode = "KRN101";

    try {
      // Check if contest already exists
      const existingContest = await db.query.contest.findFirst({
        where: eq(contest.code, contestCode),
      });

      if (!existingContest) {
        const startTime = new Date();
        const endTime = new Date();
        endTime.setDate(endTime.getDate() + 7); // Active for 7 days

        await db.insert(contest).values({
          id: contestId,
          code: contestCode,
          title: "Introduction to Algorithms",
          description: "Test your knowledge of fundamentals: Big-O, Sorting, Searching, and Basic Data Structures.",
          coverImageUrl: "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=800&q=80",
          startTime,
          endTime,
          totalQuestions: 3,
          totalTime: 45, // 45 minutes
          totalScore: 300,
          duration: 45,
          isActive: true,
          createdById: adminId,
        });
        console.log(`✅ Contest created: Code "${contestCode}"`);

        // 4. Create Questions for the contest
        await db.insert(question).values([
          {
            id: "q1",
            contestId,
            questionText: "What is the worst-case time complexity of QuickSort?",
            questionType: "mcq",
            options: ["O(n log n)", "O(n)", "O(n^2)", "O(1)"],
            correctOption: "O(n^2)",
            questionScore: 100,
            questionOrder: 1,
          },
          {
            id: "q2",
            contestId,
            questionText: "Which data structure operates on a Last-In-First-Out (LIFO) basis?",
            questionType: "mcq",
            options: ["Queue", "Stack", "Heap", "Hash Map"],
            correctOption: "Stack",
            questionScore: 100,
            questionOrder: 2,
          },
          {
            id: "q3",
            contestId,
            questionText: "Which sorting algorithm is stable and has O(n log n) worst-case complexity?",
            questionType: "mcq",
            options: ["Quick Sort", "Bubble Sort", "Merge Sort", "Selection Sort"],
            correctOption: "Merge Sort",
            questionScore: 100,
            questionOrder: 3,
          },
        ]);
        console.log("✅ Created 3 sample questions for the contest.");
      } else {
        console.log("⚠️  Sample contest already exists.");
      }
    } catch (err) {
      console.error("❌ Failed to create sample contest/questions:", err);
    }
  }

  console.log("\n🌱 Seeding complete!\n");
  process.exit(0);
}

seed();
