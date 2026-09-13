import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, boolean, index, integer, jsonb, unique } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { question, questionVersion } from "./question-bank-schema";

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

/**
 * contestQuestion — links a contest to a specific immutable version of a question.
 * When a question is added to a contest, the current approved questionVersion is
 * snapshotted here. Future edits to the question do NOT affect this record.
 */
export const contestQuestion = pgTable(
  "contest_question",
  {
    id: text("id").primaryKey(),
    contestId: text("contest_id")
      .notNull()
      .references(() => contest.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => question.id),
    // The immutable content snapshot used for this contest
    questionVersionId: text("question_version_id")
      .notNull()
      .references(() => questionVersion.id),
    // Contest-specific marks (may differ from the version's default questionScore)
    marks: integer("marks").notNull(),
    questionOrder: integer("question_order").notNull(),
  },
  (table) => [
    // A question can only appear once per contest
    unique("contest_question_uniq").on(table.contestId, table.questionId),
    // No two questions can have the same order in a contest
    unique("contest_question_order_uniq").on(table.contestId, table.questionOrder),
    index("contest_question_contest_id_idx").on(table.contestId),
    index("contest_question_question_id_idx").on(table.questionId),
  ]
);

export const contestParticipation = pgTable("contest_participation", {
  id: text("id").primaryKey(),
  contestId: text("contest_id").notNull().references(() => contest.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  score: integer("score").default(0).notNull(),
  rank: integer("rank"),
}, (table) => [
  index("participation_contest_id_idx").on(table.contestId),
  index("participation_user_id_idx").on(table.userId),
  unique("participation_contest_user_uniq").on(table.contestId, table.userId)
]);

export const submission = pgTable("submission", {
  id: text("id").primaryKey(),
  contestParticipationId: text("contest_participation_id")
    .notNull()
    .references(() => contestParticipation.id, { onDelete: "cascade" }),
  // Reference to the contest-question join record (which carries the version snapshot)
  contestQuestionId: text("contest_question_id")
    .notNull()
    .references(() => contestQuestion.id, { onDelete: "cascade" }),
  // Denormalized for convenience queries (avoids an extra join)
  questionId: text("question_id")
    .notNull()
    .references(() => question.id),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  userAnswer: text("user_answer").notNull(),
  languageId: integer("language_id"),
  status: text("status").notNull(),
  scoreObtained: integer("score_obtained").default(0).notNull(),
  executionResult: jsonb("execution_result"), // detailed JSON report of execution
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("submission_participation_idx").on(table.contestParticipationId),
  index("submission_contest_question_idx").on(table.contestQuestionId),
  index("submission_question_idx").on(table.questionId),
  index("submission_user_idx").on(table.userId)
]);

// ─── Relations ───────────────────────────────────────────────────────────────

export const contestRelations = relations(contest, ({ one, many }) => ({
  createdBy: one(user, {
    fields: [contest.createdById],
    references: [user.id],
  }),
  participations: many(contestParticipation),
  contestQuestions: many(contestQuestion),
}));

export const contestQuestionRelations = relations(contestQuestion, ({ one, many }) => ({
  contest: one(contest, {
    fields: [contestQuestion.contestId],
    references: [contest.id],
  }),
  question: one(question, {
    fields: [contestQuestion.questionId],
    references: [question.id],
  }),
  version: one(questionVersion, {
    fields: [contestQuestion.questionVersionId],
    references: [questionVersion.id],
  }),
  submissions: many(submission),
}));

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

export const submissionRelations = relations(submission, ({ one }) => ({
  participation: one(contestParticipation, {
    fields: [submission.contestParticipationId],
    references: [contestParticipation.id],
  }),
  contestQuestion: one(contestQuestion, {
    fields: [submission.contestQuestionId],
    references: [contestQuestion.id],
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
