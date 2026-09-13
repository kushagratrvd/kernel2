/**
 * Seed script: Populates the database with test data for roles, taxonomy, question bank, and contest.
 *
 * Usage: pnpm tsx src/server/db/seed.ts
 */
import "dotenv/config";
import { auth } from "../auth";
import { db } from "./index";
import { user } from "./auth-schema";
import { contest, contestQuestion } from "./contest-schema";
import {
  category,
  topic,
  question,
  questionVersion,
  questionAssignment,
  reviewComment,
} from "./question-bank-schema";
import { auditLog } from "./audit-schema";
import { eq } from "drizzle-orm";

async function findOrCreateUser(
  name: string,
  email: string,
  password: string,
  roles: string[]
) {
  try {
    const result = await auth.api.signUpEmail({
      body: { email, password, name },
    });
    const userId = result.user.id;
    await db
      .update(user)
      .set({ roles, role: roles[0]!, status: "ACTIVE" })
      .where(eq(user.id, userId));
    console.log(`✅ User created: ${email} (${password}) with roles: ${roles.join(", ")}`);
    return userId;
  } catch (err: any) {
    if (err.message?.includes("already exists") || err.message?.includes("unique")) {
      const existing = await db.query.user.findFirst({ where: eq(user.email, email) });
      if (existing) {
        await db
          .update(user)
          .set({ roles, role: roles[0]!, status: "ACTIVE" })
          .where(eq(user.id, existing.id));
        console.log(`⚠️  User updated: ${email} with roles: ${roles.join(", ")}`);
        return existing.id;
      }
    }
    console.error(`❌ Failed to create user ${email}:`, err);
    return "";
  }
}

async function seed() {
  console.log("\n🌱 Seeding database...");

  // 1. Seed Users with various roles
  const adminId = await findOrCreateUser("Admin User", "admin@kernel.dev", "admin1234Password", ["admin"]);
  const creatorId = await findOrCreateUser("Creator User", "creator@kernel.dev", "creator1234Password", ["creator"]);
  const reviewerId = await findOrCreateUser("Reviewer User", "reviewer@kernel.dev", "reviewer1234Password", ["reviewer"]);
  const studentId = await findOrCreateUser("Student User", "student@kernel.dev", "student1234Password", ["student"]);

  if (!creatorId || !reviewerId || !adminId) {
    console.error("❌ Failed to resolve critical users for seeding.");
    process.exit(1);
  }

  // 2. Seed Taxonomy (Categories and Topics)
  const dsaCatId = "cat-dsa";
  const webCatId = "cat-web";

  await db
    .insert(category)
    .values([
      { id: dsaCatId, name: "DSA" },
      { id: webCatId, name: "Web Development" },
    ])
    .onConflictDoNothing();

  const arraysTopicId = "topic-arrays";
  const treesTopicId = "topic-trees";
  const jsTopicId = "topic-js";

  await db
    .insert(topic)
    .values([
      { id: arraysTopicId, categoryId: dsaCatId, name: "Arrays" },
      { id: treesTopicId, categoryId: dsaCatId, name: "Trees" },
      { id: jsTopicId, categoryId: webCatId, name: "JavaScript" },
    ])
    .onConflictDoNothing();

  console.log("✅ Taxonomy seeded (Categories: DSA, Web Development; Topics: Arrays, Trees, JavaScript).");

  // 3. Seed Question Bank
  // Q1: MCQ (QuickSort complexity) - APPROVED
  const q1Id = "q-bank-1";
  const q1v1Id = "qv-bank-1-v1";
  const q1Draft = {
    title: "QuickSort Time Complexity",
    description: "What is the worst-case time complexity of QuickSort algorithm when the pivot choice is poor?",
    options: [
      { id: "opt_a", text: "O(n log n)" },
      { id: "opt_b", text: "O(n)" },
      { id: "opt_c", text: "O(n^2)" },
      { id: "opt_d", text: "O(1)" },
    ],
    correctOptionId: "opt_c",
    hint: "Think about when the array is already sorted and we pick the first or last element as pivot.",
    questionScore: 100,
  };

  await db
    .insert(question)
    .values({
      id: q1Id,
      questionType: "mcq",
      categoryId: dsaCatId,
      topicId: arraysTopicId,
      difficulty: "easy",
      status: "APPROVED",
      currentVersionId: q1v1Id,
      currentDraft: q1Draft,
      createdById: creatorId,
    })
    .onConflictDoNothing();

  await db
    .insert(questionVersion)
    .values({
      id: q1v1Id,
      questionId: q1Id,
      version: 1,
      title: q1Draft.title,
      description: q1Draft.description,
      options: q1Draft.options,
      correctOptionId: q1Draft.correctOptionId,
      hint: q1Draft.hint,
      questionScore: q1Draft.questionScore,
      createdById: creatorId,
    })
    .onConflictDoNothing();

  // Q2: Text (C++ standard input stream) - APPROVED
  const q2Id = "q-bank-2";
  const q2v1Id = "qv-bank-2-v1";
  const q2Draft = {
    title: "C++ Input Stream",
    description: "What is the name of the standard input stream object in C++ standard library?",
    correctOptionId: "cin",
    hint: "It belongs to the <iostream> header and is used with the extraction operator >>.",
    questionScore: 100,
  };

  await db
    .insert(question)
    .values({
      id: q2Id,
      questionType: "text",
      categoryId: dsaCatId,
      topicId: arraysTopicId,
      difficulty: "easy",
      status: "APPROVED",
      currentVersionId: q2v1Id,
      currentDraft: q2Draft,
      createdById: creatorId,
    })
    .onConflictDoNothing();

  await db
    .insert(questionVersion)
    .values({
      id: q2v1Id,
      questionId: q2Id,
      version: 1,
      title: q2Draft.title,
      description: q2Draft.description,
      correctOptionId: q2Draft.correctOptionId,
      hint: q2Draft.hint,
      questionScore: q2Draft.questionScore,
      createdById: creatorId,
    })
    .onConflictDoNothing();

  // Q3: Code (Hello World Name Program) - APPROVED
  const q3Id = "q-bank-3";
  const q3v1Id = "qv-bank-3-v1";
  const q3Draft = {
    title: "Greeting Program",
    description: "Write a program that reads a string representing a name from standard input (stdin) and prints 'Hello, {name}!' to standard output (stdout).",
    questionScore: 100,
    timeLimit: 5,
    memoryLimit: 128000,
    allowedLanguages: [50, 54, 62, 63, 71],
    starterCode: {
      "50": "#include <stdio.h>\n\nint main() {\n    char name[100];\n    if (scanf(\"%99s\", name) == 1) {\n        printf(\"Hello, %s!\\n\", name);\n    }\n    return 0;\n}",
      "54": "#include <iostream>\n#include <string>\n\nusing namespace std;\n\nint main() {\n    string name;\n    if (cin >> name) {\n        cout << \"Hello, \" << name << \"!\" << endl;\n    }\n    return 0;\n}",
      "62": "import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner scanner = new Scanner(System.in);\n        if (scanner.hasNext()) {\n            String name = scanner.next();\n            System.out.println(\"Hello, \" + name + \"!\");\n        }\n        scanner.close();\n    }\n}",
      "63": "const readline = require('readline');\n\nconst rl = readline.createInterface({\n    input: process.stdin,\n    output: process.stdout\n});\n\nrl.on('line', (line) => {\n    console.log(`Hello, ${line}!`);\n    process.exit(0);\n});",
      "71": "import sys\n\ndef main():\n    line = sys.stdin.read().strip()\n    if line:\n        print(f\"Hello, {line}!\")\n\nif __name__ == \"__main__\":\n    main()",
    },
    testCases: [
      { input: "Chai", expectedOutput: "Hello, Chai!", isSample: true },
      { input: "Kernel", expectedOutput: "Hello, Kernel!", isSample: true },
      { input: "Antigravity", expectedOutput: "Hello, Antigravity!", isSample: false },
    ],
  };

  await db
    .insert(question)
    .values({
      id: q3Id,
      questionType: "code",
      categoryId: dsaCatId,
      topicId: arraysTopicId,
      difficulty: "easy",
      status: "APPROVED",
      currentVersionId: q3v1Id,
      currentDraft: q3Draft,
      createdById: creatorId,
    })
    .onConflictDoNothing();

  await db
    .insert(questionVersion)
    .values({
      id: q3v1Id,
      questionId: q3Id,
      version: 1,
      title: q3Draft.title,
      description: q3Draft.description,
      questionScore: q3Draft.questionScore,
      timeLimit: q3Draft.timeLimit,
      memoryLimit: q3Draft.memoryLimit,
      allowedLanguages: q3Draft.allowedLanguages,
      starterCode: q3Draft.starterCode,
      testCases: q3Draft.testCases,
      createdById: creatorId,
    })
    .onConflictDoNothing();

  // Q4: DRAFT question (in creator workspace)
  const q4Id = "q-bank-4";
  await db
    .insert(question)
    .values({
      id: q4Id,
      questionType: "mcq",
      categoryId: dsaCatId,
      topicId: arraysTopicId,
      difficulty: "medium",
      status: "DRAFT",
      currentVersionId: null,
      currentDraft: {
        title: "Binary Search Prerequisite",
        description: "What condition must an array satisfy before Binary Search can be applied?",
        options: [
          { id: "opt_1", text: "Array elements must be sorted." },
          { id: "opt_2", text: "Array size must be a power of 2." },
          { id: "opt_3", text: "Array must contain only unique positive numbers." },
        ],
        correctOptionId: "opt_1",
        questionScore: 50,
      },
      createdById: creatorId,
    })
    .onConflictDoNothing();

  // Q5: SUBMITTED_FOR_REVIEW question (in reviewer queue)
  const q5Id = "q-bank-5";
  const q5v1Id = "qv-bank-5-v1";
  const q5Draft = {
    title: "Two Sum Problem",
    description: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
    questionScore: 100,
    timeLimit: 5,
    memoryLimit: 128000,
    allowedLanguages: [71],
    starterCode: {
      "71": "def two_sum(nums, target):\n    # Return [i, j]\n    pass",
    },
    testCases: [
      { input: "2 7 11 15\n9", expectedOutput: "0 1", isSample: true },
    ],
  };

  await db
    .insert(question)
    .values({
      id: q5Id,
      questionType: "code",
      categoryId: dsaCatId,
      topicId: arraysTopicId,
      difficulty: "medium",
      status: "SUBMITTED_FOR_REVIEW",
      currentVersionId: q5v1Id,
      currentDraft: q5Draft,
      createdById: creatorId,
    })
    .onConflictDoNothing();

  await db
    .insert(questionVersion)
    .values({
      id: q5v1Id,
      questionId: q5Id,
      version: 1,
      title: q5Draft.title,
      description: q5Draft.description,
      questionScore: q5Draft.questionScore,
      timeLimit: q5Draft.timeLimit,
      memoryLimit: q5Draft.memoryLimit,
      allowedLanguages: q5Draft.allowedLanguages,
      starterCode: q5Draft.starterCode,
      testCases: q5Draft.testCases,
      createdById: creatorId,
    })
    .onConflictDoNothing();

  const q5AssignmentId = "assign-q5-v1";
  await db
    .insert(questionAssignment)
    .values({
      id: q5AssignmentId,
      questionId: q5Id,
      versionId: q5v1Id,
      reviewerId: reviewerId,
      assignedById: creatorId,
      status: "PENDING",
    })
    .onConflictDoNothing();

  console.log("✅ Question Bank seeded with 5 questions across DRAFT, SUBMITTED_FOR_REVIEW, and APPROVED states.");

  // 4. Create Contest & Add Snapshots
  const contestId = "test-contest-uuid-1";
  const contestCode = "KRN101";

  const existingContest = await db.query.contest.findFirst({
    where: eq(contest.code, contestCode),
  });

  if (!existingContest) {
    const startTime = new Date();
    const endTime = new Date();
    endTime.setDate(endTime.getDate() + 7);

    await db.insert(contest).values({
      id: contestId,
      code: contestCode,
      title: "Introduction to Algorithms",
      description: "Test your knowledge of fundamentals: Big-O, Sorting, Searching, and Basic Data Structures.",
      coverImageUrl: "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=800&q=80",
      startTime,
      endTime,
      totalQuestions: 3,
      totalTime: 45,
      totalScore: 300,
      duration: 45,
      isActive: true,
      createdById: adminId,
    });

    // Attach snapshots of approved questions to contest
    await db.insert(contestQuestion).values([
      {
        id: "cq-1",
        contestId,
        questionId: q1Id,
        questionVersionId: q1v1Id,
        marks: 100,
        questionOrder: 1,
      },
      {
        id: "cq-2",
        contestId,
        questionId: q2Id,
        questionVersionId: q2v1Id,
        marks: 100,
        questionOrder: 2,
      },
      {
        id: "cq-3",
        contestId,
        questionId: q3Id,
        questionVersionId: q3v1Id,
        marks: 100,
        questionOrder: 3,
      },
    ]);

    console.log(`✅ Contest created: Code "${contestCode}" with 3 question snapshots attached.`);
  } else {
    console.log("⚠️  Sample contest already exists.");
  }

  // 5. Seed Audit Log sample
  await db
    .insert(auditLog)
    .values({
      id: crypto.randomUUID(),
      userId: adminId,
      action: "DATABASE_SEEDED",
      entityType: "system",
      entityId: "initial_seed",
      metadata: { seededBy: "system_seeder" },
    })
    .onConflictDoNothing();

  console.log("\n🌱 Seeding complete successfully!\n");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
