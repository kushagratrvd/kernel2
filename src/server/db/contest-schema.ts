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

export const contestParticipationRelations = relations(contestParticipation, ({ one }) => ({ 
  contest: one(contest, { 
    fields: [contestParticipation.contestId], 
    references: [contest.id], 
  }), 
  user: one(user, { 
    fields: [contestParticipation.userId], 
    references: [user.id], 
  }), 
})); 

export const question = pgTable("question", {
  id: text("id").primaryKey(), 
  contestId: text("contest_id").notNull().references(() => contest.id, { onDelete: "cascade" }), 
  questionText: text("question_text").notNull(), 
  questionType: text("question_type").notNull(), // e.g., "multiple-choice", "text"
  options: jsonb("options"), // Array of options if MCQ
  correctOption: text("correct_option"), 
  questionScore: integer("question_score").notNull(), 
  questionTime: integer("question_time"), // Optional time limit per question in seconds
  questionOrder: integer("question_order").notNull(), 
}, (table) => [
  index("question_contest_id_idx").on(table.contestId)
]);

export const contestRelations = relations(contest, ({ many }) => ({
  participations: many(contestParticipation),
  questions: many(question),
}));

export const questionRelations = relations(question, ({ one }) => ({
  contest: one(contest, {
    fields: [question.contestId],
    references: [contest.id],
  }),
}));