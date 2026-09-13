-- ==========================================================
-- Schema Migration for Roles, Question Bank, and Contest Snapshots
-- ==========================================================

-- Drop old tables that are changing structure
DROP TABLE IF EXISTS "submission" CASCADE;
DROP TABLE IF EXISTS "contest_question" CASCADE;
DROP TABLE IF EXISTS "test_case" CASCADE;
DROP TABLE IF EXISTS "review_comment" CASCADE;
DROP TABLE IF EXISTS "question_assignment" CASCADE;
DROP TABLE IF EXISTS "question_version" CASCADE;
DROP TABLE IF EXISTS "question" CASCADE;
DROP TABLE IF EXISTS "topic" CASCADE;
DROP TABLE IF EXISTS "category" CASCADE;
DROP TABLE IF EXISTS "audit_log" CASCADE;
DROP TABLE IF EXISTS "contest_participation" CASCADE;
DROP TABLE IF EXISTS "contest" CASCADE;

-- 1. Update user table for multi-role and status
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "roles" jsonb NOT NULL DEFAULT '["student"]'::jsonb;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'ACTIVE';

-- 2. Category & Topic (Taxonomy)
CREATE TABLE IF NOT EXISTS "category" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL UNIQUE,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "topic" (
  "id" text PRIMARY KEY,
  "category_id" text NOT NULL REFERENCES "category"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "topic_category_name_uniq" UNIQUE ("category_id", "name")
);
CREATE INDEX IF NOT EXISTS "topic_category_id_idx" ON "topic"("category_id");

-- 3. Question (Identity, Lifecycle & Mutable Working Draft)
CREATE TABLE IF NOT EXISTS "question" (
  "id" text PRIMARY KEY,
  "question_type" text NOT NULL,
  "category_id" text REFERENCES "category"("id") ON DELETE SET NULL,
  "topic_id" text REFERENCES "topic"("id") ON DELETE SET NULL,
  "difficulty" text NOT NULL,
  "status" text DEFAULT 'DRAFT' NOT NULL,
  "current_version_id" text,
  "current_draft" jsonb NOT NULL,
  "created_by_id" text NOT NULL REFERENCES "user"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "question_status_idx" ON "question"("status");
CREATE INDEX IF NOT EXISTS "question_created_by_idx" ON "question"("created_by_id");
CREATE INDEX IF NOT EXISTS "question_category_id_idx" ON "question"("category_id");

-- 4. Question Version (Immutable Content Snapshots)
CREATE TABLE IF NOT EXISTS "question_version" (
  "id" text PRIMARY KEY,
  "question_id" text NOT NULL REFERENCES "question"("id") ON DELETE CASCADE,
  "version" integer NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "options" jsonb,
  "correct_option_id" text,
  "hint" text,
  "question_score" integer NOT NULL,
  "starter_code" jsonb,
  "allowed_languages" jsonb,
  "time_limit" integer DEFAULT 5 NOT NULL,
  "memory_limit" integer DEFAULT 128000 NOT NULL,
  "test_cases" jsonb,
  "created_by_id" text NOT NULL REFERENCES "user"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "question_version_uniq" UNIQUE ("question_id", "version")
);
CREATE INDEX IF NOT EXISTS "question_version_question_id_idx" ON "question_version"("question_id");

-- 5. Question Assignment (Review Tracking)
CREATE TABLE IF NOT EXISTS "question_assignment" (
  "id" text PRIMARY KEY,
  "question_id" text NOT NULL REFERENCES "question"("id") ON DELETE CASCADE,
  "version_id" text NOT NULL REFERENCES "question_version"("id"),
  "reviewer_id" text NOT NULL REFERENCES "user"("id"),
  "assigned_by_id" text NOT NULL REFERENCES "user"("id"),
  "assigned_at" timestamp DEFAULT now() NOT NULL,
  "status" text DEFAULT 'PENDING' NOT NULL,
  "completed_at" timestamp
);
CREATE INDEX IF NOT EXISTS "assignment_question_id_idx" ON "question_assignment"("question_id");
CREATE INDEX IF NOT EXISTS "assignment_reviewer_id_idx" ON "question_assignment"("reviewer_id");
CREATE INDEX IF NOT EXISTS "assignment_status_idx" ON "question_assignment"("status");

-- 6. Review Comment (Threaded Reviews)
CREATE TABLE IF NOT EXISTS "review_comment" (
  "id" text PRIMARY KEY,
  "question_id" text NOT NULL REFERENCES "question"("id") ON DELETE CASCADE,
  "assignment_id" text NOT NULL REFERENCES "question_assignment"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id"),
  "message" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "review_comment_question_id_idx" ON "review_comment"("question_id");
CREATE INDEX IF NOT EXISTS "review_comment_assignment_id_idx" ON "review_comment"("assignment_id");

-- 7. Contest Table
CREATE TABLE IF NOT EXISTS "contest" (
  "id" text PRIMARY KEY,
  "code" text NOT NULL UNIQUE,
  "title" text NOT NULL,
  "description" text,
  "cover_image_url" text,
  "start_time" timestamp NOT NULL,
  "end_time" timestamp NOT NULL,
  "total_questions" integer NOT NULL,
  "total_time" integer NOT NULL,
  "total_score" integer NOT NULL,
  "duration" integer,
  "isActive" boolean DEFAULT false NOT NULL,
  "created_by_id" text NOT NULL REFERENCES "user"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- 8. Contest Question (Links Contest to Question Version Snapshot)
CREATE TABLE IF NOT EXISTS "contest_question" (
  "id" text PRIMARY KEY,
  "contest_id" text NOT NULL REFERENCES "contest"("id") ON DELETE CASCADE,
  "question_id" text NOT NULL REFERENCES "question"("id"),
  "question_version_id" text NOT NULL REFERENCES "question_version"("id"),
  "marks" integer NOT NULL,
  "question_order" integer NOT NULL,
  CONSTRAINT "contest_question_uniq" UNIQUE ("contest_id", "question_id"),
  CONSTRAINT "contest_question_order_uniq" UNIQUE ("contest_id", "question_order")
);
CREATE INDEX IF NOT EXISTS "contest_question_contest_id_idx" ON "contest_question"("contest_id");
CREATE INDEX IF NOT EXISTS "contest_question_question_id_idx" ON "contest_question"("question_id");

-- 9. Contest Participation
CREATE TABLE IF NOT EXISTS "contest_participation" (
  "id" text PRIMARY KEY,
  "contest_id" text NOT NULL REFERENCES "contest"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "joined_at" timestamp DEFAULT now() NOT NULL,
  "started_at" timestamp,
  "finished_at" timestamp,
  "score" integer DEFAULT 0 NOT NULL,
  "rank" integer,
  CONSTRAINT "participation_contest_user_uniq" UNIQUE ("contest_id", "user_id")
);
CREATE INDEX IF NOT EXISTS "participation_contest_id_idx" ON "contest_participation"("contest_id");
CREATE INDEX IF NOT EXISTS "participation_user_id_idx" ON "contest_participation"("user_id");

-- 10. Submission
CREATE TABLE IF NOT EXISTS "submission" (
  "id" text PRIMARY KEY,
  "contest_participation_id" text NOT NULL REFERENCES "contest_participation"("id") ON DELETE CASCADE,
  "contest_question_id" text NOT NULL REFERENCES "contest_question"("id") ON DELETE CASCADE,
  "question_id" text NOT NULL REFERENCES "question"("id"),
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "user_answer" text NOT NULL,
  "language_id" integer,
  "status" text NOT NULL,
  "score_obtained" integer DEFAULT 0 NOT NULL,
  "execution_result" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "submission_participation_idx" ON "submission"("contest_participation_id");
CREATE INDEX IF NOT EXISTS "submission_contest_question_idx" ON "submission"("contest_question_id");
CREATE INDEX IF NOT EXISTS "submission_question_idx" ON "submission"("question_id");
CREATE INDEX IF NOT EXISTS "submission_user_idx" ON "submission"("user_id");

-- 11. System-Wide Audit Log
CREATE TABLE IF NOT EXISTS "audit_log" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id"),
  "action" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "audit_log_user_id_idx" ON "audit_log"("user_id");
CREATE INDEX IF NOT EXISTS "audit_log_entity_idx" ON "audit_log"("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "audit_log_created_at_idx" ON "audit_log"("created_at");
CREATE INDEX IF NOT EXISTS "audit_log_action_idx" ON "audit_log"("action");
