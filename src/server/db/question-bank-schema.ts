import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

// ─── Taxonomy ────────────────────────────────────────────────────────────────

export const category = pgTable("category", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const topic = pgTable(
  "topic",
  {
    id: text("id").primaryKey(),
    categoryId: text("category_id")
      .notNull()
      .references(() => category.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("topic_category_name_uniq").on(table.categoryId, table.name),
    index("topic_category_id_idx").on(table.categoryId),
  ]
);

// ─── Question (Identity + Lifecycle + Mutable Working Draft) ─────────────────

/**
 * question.currentDraft holds the mutable working copy.
 * question.currentVersionId points to the last submitted (immutable) snapshot.
 * questionVersion rows are ONLY created on submitForReview — never on regular edits.
 */
export const question = pgTable(
  "question",
  {
    id: text("id").primaryKey(),

    // Immutable after creation
    questionType: text("question_type").notNull(), // "mcq" | "text" | "code"

    // Taxonomy
    categoryId: text("category_id").references(() => category.id, {
      onDelete: "set null",
    }),
    topicId: text("topic_id").references(() => topic.id, {
      onDelete: "set null",
    }),
    difficulty: text("difficulty").notNull(), // "easy" | "medium" | "hard"

    // Lifecycle state
    // DRAFT | SUBMITTED_FOR_REVIEW | UNDER_REVIEW | CHANGES_REQUESTED | APPROVED | REJECTED | ARCHIVED
    status: text("status").notNull().default("DRAFT"),

    // NULL until first submitForReview; points to latest submitted snapshot
    currentVersionId: text("current_version_id"),

    // Mutable working draft — freely editable by the creator before submission.
    // Shape matches QuestionDraftContent interface.
    currentDraft: jsonb("current_draft").notNull(),

    createdById: text("created_by_id")
      .notNull()
      .references(() => user.id),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("question_status_idx").on(table.status),
    index("question_created_by_idx").on(table.createdById),
    index("question_category_id_idx").on(table.categoryId),
  ]
);

// ─── Question Version (Immutable Content Snapshot) ───────────────────────────

/**
 * Created ONLY upon submitForReview. Never mutated after insertion.
 * Full question content including embedded test cases is captured here.
 */
export const questionVersion = pgTable(
  "question_version",
  {
    id: text("id").primaryKey(),
    questionId: text("question_id")
      .notNull()
      .references(() => question.id, { onDelete: "cascade" }),
    version: integer("version").notNull(), // 1, 2, 3 ...

    title: text("title").notNull(),
    description: text("description").notNull(),

    // MCQ: [{ id: "a", text: "Option text" }, ...]
    options: jsonb("options"),
    // Matches one option.id value — e.g. "a"
    correctOptionId: text("correct_option_id"),

    hint: text("hint"),
    questionScore: integer("question_score").notNull(),

    // Code questions
    // { "71": "import sys...", "54": "#include ..." }
    starterCode: jsonb("starter_code"),
    // [50, 54, 62, 63, 71]
    allowedLanguages: jsonb("allowed_languages"),
    timeLimit: integer("time_limit").default(5).notNull(), // seconds
    memoryLimit: integer("memory_limit").default(128000).notNull(), // KB

    // Embedded test cases — ensures the snapshot is fully self-contained.
    // [{ input: string, expectedOutput: string, isSample: boolean }]
    testCases: jsonb("test_cases"),

    createdById: text("created_by_id")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("question_version_uniq").on(table.questionId, table.version),
    index("question_version_question_id_idx").on(table.questionId),
  ]
);

// ─── Question Assignment (Review Tracking) ───────────────────────────────────

export const questionAssignment = pgTable(
  "question_assignment",
  {
    id: text("id").primaryKey(),
    questionId: text("question_id")
      .notNull()
      .references(() => question.id, { onDelete: "cascade" }),
    // The exact version snapshot being reviewed
    versionId: text("version_id")
      .notNull()
      .references(() => questionVersion.id),
    reviewerId: text("reviewer_id")
      .notNull()
      .references(() => user.id),
    // Creator who picked this reviewer
    assignedById: text("assigned_by_id")
      .notNull()
      .references(() => user.id),
    assignedAt: timestamp("assigned_at").defaultNow().notNull(),
    // PENDING | IN_REVIEW | COMPLETED | CANCELLED
    status: text("status").notNull().default("PENDING"),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("assignment_question_id_idx").on(table.questionId),
    index("assignment_reviewer_id_idx").on(table.reviewerId),
    index("assignment_status_idx").on(table.status),
  ]
);

// ─── Review Comment (Threaded Conversation) ──────────────────────────────────

export const reviewComment = pgTable(
  "review_comment",
  {
    id: text("id").primaryKey(),
    questionId: text("question_id")
      .notNull()
      .references(() => question.id, { onDelete: "cascade" }),
    assignmentId: text("assignment_id")
      .notNull()
      .references(() => questionAssignment.id, { onDelete: "cascade" }),
    // Either the creator or the reviewer
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    message: text("message").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("review_comment_question_id_idx").on(table.questionId),
    index("review_comment_assignment_id_idx").on(table.assignmentId),
  ]
);

// ─── Relations ───────────────────────────────────────────────────────────────

export const categoryRelations = relations(category, ({ many }) => ({
  topics: many(topic),
  questions: many(question),
}));

export const topicRelations = relations(topic, ({ one, many }) => ({
  category: one(category, {
    fields: [topic.categoryId],
    references: [category.id],
  }),
  questions: many(question),
}));

export const questionRelations = relations(question, ({ one, many }) => ({
  category: one(category, {
    fields: [question.categoryId],
    references: [category.id],
  }),
  topic: one(topic, {
    fields: [question.topicId],
    references: [topic.id],
  }),
  createdBy: one(user, {
    fields: [question.createdById],
    references: [user.id],
  }),
  currentVersion: one(questionVersion, {
    fields: [question.currentVersionId],
    references: [questionVersion.id],
  }),
  versions: many(questionVersion),
  assignments: many(questionAssignment),
  comments: many(reviewComment),
}));

export const questionVersionRelations = relations(
  questionVersion,
  ({ one, many }) => ({
    question: one(question, {
      fields: [questionVersion.questionId],
      references: [question.id],
    }),
    createdBy: one(user, {
      fields: [questionVersion.createdById],
      references: [user.id],
    }),
    assignments: many(questionAssignment),
  })
);

export const questionAssignmentRelations = relations(
  questionAssignment,
  ({ one, many }) => ({
    question: one(question, {
      fields: [questionAssignment.questionId],
      references: [question.id],
    }),
    version: one(questionVersion, {
      fields: [questionAssignment.versionId],
      references: [questionVersion.id],
    }),
    reviewer: one(user, {
      fields: [questionAssignment.reviewerId],
      references: [user.id],
    }),
    assignedBy: one(user, {
      fields: [questionAssignment.assignedById],
      references: [user.id],
    }),
    comments: many(reviewComment),
  })
);

export const reviewCommentRelations = relations(reviewComment, ({ one }) => ({
  question: one(question, {
    fields: [reviewComment.questionId],
    references: [question.id],
  }),
  assignment: one(questionAssignment, {
    fields: [reviewComment.assignmentId],
    references: [questionAssignment.id],
  }),
  user: one(user, {
    fields: [reviewComment.userId],
    references: [user.id],
  }),
}));
