import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

/**
 * System-wide audit log — records all significant actions.
 *
 * action examples:
 *   QUESTION_CREATED, QUESTION_SUBMITTED, QUESTION_DRAFT_UPDATED,
 *   REVIEW_PICKED_UP, REVIEW_CHANGES_REQUESTED, REVIEW_APPROVED, REVIEW_REJECTED,
 *   CONTEST_QUESTION_ADDED, CONTEST_QUESTION_REMOVED,
 *   USER_ROLE_ADDED, USER_ROLE_REMOVED, USER_DEACTIVATED, USER_REACTIVATED
 *
 * entityType examples: "question" | "assignment" | "contest" | "user"
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    // Action-specific context, e.g. { "fromRole": "student", "toRole": "reviewer" }
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("audit_log_user_id_idx").on(table.userId),
    index("audit_log_entity_idx").on(table.entityType, table.entityId),
    index("audit_log_created_at_idx").on(table.createdAt),
    index("audit_log_action_idx").on(table.action),
  ]
);

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  user: one(user, {
    fields: [auditLog.userId],
    references: [user.id],
  }),
}));
