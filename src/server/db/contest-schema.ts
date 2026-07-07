import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, boolean, index, integer, jsonb, unique } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export const contest = pgTable("contest", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  coverImageUrl: text("cover_image_url"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  totalQuestions: integer("total_questions").notNull(),
  totalTime: integer("total_time").notNull(), // in minutes
  totalScore: integer("total_score").notNull(),
  duration: integer("duration"), // in minutes
  isActive: boolean("isActive").default(false).notNull(),
  createdById: text("created_by_id")
    .notNull()
    .references(() => user.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const contestParticipation = pgTable("contest_participation", {
  id: text("id").primaryKey(), 
  contestId: text("contest_id").notNull().references(() => contest.id, { onDelete: "cascade" }), 
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }), 
  joinedAt: timestamp("joined_at").defaultNow().notNull(), 
  startedAt: timestamp("started_at"), // Can be null until they click "Start Contest"
  finishedAt: timestamp("finished_at"), // Can be null until they finish/time expires
  score: integer("score").default(0).notNull(), 
  rank: integer("rank"),
}, (table) => [
  index("participation_contest_id_idx").on(table.contestId),
  index("participation_user_id_idx").on(table.userId),
  unique("participation_contest_user_uniq").on(table.contestId, table.userId)
]);

export const contestParticipationRelations = relations(contestParticipation, ({ one, many }) => ({ 
  contest: one(contest, { 
    fields: [contestParticipation.contestId], 
    references: [contest.id], 
  }), 
  user: one(user, { 
    fields: [contestParticipation.userId], 
    references: [user.id], 
  }), 
  submissions: many(submission),
})); 

export const question = pgTable("question", {
  id: text("id").primaryKey(), 
  contestId: text("contest_id").notNull().references(() => contest.id, { onDelete: "cascade" }), 
  questionText: text("question_text").notNull(), 
  questionType: text("question_type").notNull(), // e.g., "mcq", "text", "code"
  options: jsonb("options"), // Array of options if MCQ
  correctOption: text("correct_option"), 
  questionScore: integer("question_score").notNull(), 
  questionTime: integer("question_time"), // Optional time limit per question in seconds
  questionOrder: integer("question_order").notNull(), 
  
  // Code specific settings
  starterCode: jsonb("starter_code"), // JSON object mapping language ID -> starter code
  allowedLanguages: jsonb("allowed_languages"), // Array of allowed language IDs (numbers)
  timeLimit: integer("time_limit").default(5).notNull(), // execution time limit in seconds
  memoryLimit: integer("memory_limit").default(128000).notNull(), // execution memory limit in KB
}, (table) => [
  index("question_contest_id_idx").on(table.contestId)
]);

export const contestRelations = relations(contest, ({ many }) => ({
  participations: many(contestParticipation),
  questions: many(question),
}));

export const questionRelations = relations(question, ({ one, many }) => ({
  contest: one(contest, {
    fields: [question.contestId],
    references: [contest.id],
  }),
  testCases: many(testCase),
  submissions: many(submission),
}));

export const testCase = pgTable("test_case", {
  id: text("id").primaryKey(),
  questionId: text("question_id").notNull().references(() => question.id, { onDelete: "cascade" }),
  input: text("input").notNull(),
  expectedOutput: text("expected_output").notNull(),
  isSample: boolean("is_sample").default(false).notNull(),
}, (table) => [
  index("test_case_question_id_idx").on(table.questionId)
]);

export const testCaseRelations = relations(testCase, ({ one }) => ({
  question: one(question, {
    fields: [testCase.questionId],
    references: [question.id],
  }),
}));

export const submission = pgTable("submission", {
  id: text("id").primaryKey(),
  contestParticipationId: text("contest_participation_id").notNull().references(() => contestParticipation.id, { onDelete: "cascade" }),
  questionId: text("question_id").notNull().references(() => question.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  userAnswer: text("user_answer").notNull(), // stores option string, text input, or code source
  languageId: integer("language_id"), // for code questions
  status: text("status").notNull(), // "Accepted", "Wrong Answer", "Runtime Error", "Compilation Error", "Time Limit Exceeded", etc.
  scoreObtained: integer("score_obtained").default(0).notNull(),
  executionResult: jsonb("execution_result"), // detailed JSON report of execution
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("submission_participation_idx").on(table.contestParticipationId),
  index("submission_question_idx").on(table.questionId),
  index("submission_user_idx").on(table.userId)
]);

export const submissionRelations = relations(submission, ({ one }) => ({
  participation: one(contestParticipation, {
    fields: [submission.contestParticipationId],
    references: [contestParticipation.id],
  }),
  question: one(question, {
    fields: [submission.questionId],
    references: [question.id],
  }),
  user: one(user, {
    fields: [submission.userId],
    references: [user.id],
  }),
}));