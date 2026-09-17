CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"impersonatedBy" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"roles" jsonb NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"banned" boolean DEFAULT false NOT NULL,
	"ban_reason" text,
	"ban_expires" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contest" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
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
	"created_by_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "contest_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "contest_participation" (
	"id" text PRIMARY KEY NOT NULL,
	"contest_id" text NOT NULL,
	"user_id" text NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"finished_at" timestamp,
	"score" integer DEFAULT 0 NOT NULL,
	"rank" integer,
	CONSTRAINT "participation_contest_user_uniq" UNIQUE("contest_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "contest_question" (
	"id" text PRIMARY KEY NOT NULL,
	"contest_id" text NOT NULL,
	"question_id" text NOT NULL,
	"question_version_id" text NOT NULL,
	"marks" integer NOT NULL,
	"question_order" integer NOT NULL,
	CONSTRAINT "contest_question_uniq" UNIQUE("contest_id","question_id"),
	CONSTRAINT "contest_question_order_uniq" UNIQUE("contest_id","question_order")
);
--> statement-breakpoint
CREATE TABLE "submission" (
	"id" text PRIMARY KEY NOT NULL,
	"contest_participation_id" text NOT NULL,
	"contest_question_id" text NOT NULL,
	"question_id" text NOT NULL,
	"user_id" text NOT NULL,
	"user_answer" text NOT NULL,
	"language_id" integer,
	"status" text NOT NULL,
	"score_obtained" integer DEFAULT 0 NOT NULL,
	"execution_result" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "category_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "question" (
	"id" text PRIMARY KEY NOT NULL,
	"question_type" text NOT NULL,
	"category_id" text,
	"topic_id" text,
	"difficulty" text NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"current_version_id" text,
	"current_draft" jsonb NOT NULL,
	"created_by_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_assignment" (
	"id" text PRIMARY KEY NOT NULL,
	"question_id" text NOT NULL,
	"version_id" text NOT NULL,
	"reviewer_id" text NOT NULL,
	"assigned_by_id" text NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "question_version" (
	"id" text PRIMARY KEY NOT NULL,
	"question_id" text NOT NULL,
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
	"created_by_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "question_version_uniq" UNIQUE("question_id","version")
);
--> statement-breakpoint
CREATE TABLE "review_comment" (
	"id" text PRIMARY KEY NOT NULL,
	"question_id" text NOT NULL,
	"assignment_id" text NOT NULL,
	"user_id" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topic" (
	"id" text PRIMARY KEY NOT NULL,
	"category_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "topic_category_name_uniq" UNIQUE("category_id","name")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_api_key" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"provider" text DEFAULT 'gemini' NOT NULL,
	"encrypted_key" text NOT NULL,
	"iv" text NOT NULL,
	"auth_tag" text NOT NULL,
	"masked_key" text NOT NULL,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_impersonatedBy_user_id_fk" FOREIGN KEY ("impersonatedBy") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest" ADD CONSTRAINT "contest_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_participation" ADD CONSTRAINT "contest_participation_contest_id_contest_id_fk" FOREIGN KEY ("contest_id") REFERENCES "public"."contest"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_participation" ADD CONSTRAINT "contest_participation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_question" ADD CONSTRAINT "contest_question_contest_id_contest_id_fk" FOREIGN KEY ("contest_id") REFERENCES "public"."contest"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_question" ADD CONSTRAINT "contest_question_question_id_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."question"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_question" ADD CONSTRAINT "contest_question_question_version_id_question_version_id_fk" FOREIGN KEY ("question_version_id") REFERENCES "public"."question_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission" ADD CONSTRAINT "submission_contest_participation_id_contest_participation_id_fk" FOREIGN KEY ("contest_participation_id") REFERENCES "public"."contest_participation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission" ADD CONSTRAINT "submission_contest_question_id_contest_question_id_fk" FOREIGN KEY ("contest_question_id") REFERENCES "public"."contest_question"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission" ADD CONSTRAINT "submission_question_id_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."question"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission" ADD CONSTRAINT "submission_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question" ADD CONSTRAINT "question_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question" ADD CONSTRAINT "question_topic_id_topic_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topic"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question" ADD CONSTRAINT "question_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_assignment" ADD CONSTRAINT "question_assignment_question_id_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."question"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_assignment" ADD CONSTRAINT "question_assignment_version_id_question_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."question_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_assignment" ADD CONSTRAINT "question_assignment_reviewer_id_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_assignment" ADD CONSTRAINT "question_assignment_assigned_by_id_user_id_fk" FOREIGN KEY ("assigned_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_version" ADD CONSTRAINT "question_version_question_id_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."question"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_version" ADD CONSTRAINT "question_version_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_comment" ADD CONSTRAINT "review_comment_question_id_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."question"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_comment" ADD CONSTRAINT "review_comment_assignment_id_question_assignment_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."question_assignment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_comment" ADD CONSTRAINT "review_comment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic" ADD CONSTRAINT "topic_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_api_key" ADD CONSTRAINT "user_api_key_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "participation_contest_id_idx" ON "contest_participation" USING btree ("contest_id");--> statement-breakpoint
CREATE INDEX "participation_user_id_idx" ON "contest_participation" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "contest_question_contest_id_idx" ON "contest_question" USING btree ("contest_id");--> statement-breakpoint
CREATE INDEX "contest_question_question_id_idx" ON "contest_question" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "submission_participation_idx" ON "submission" USING btree ("contest_participation_id");--> statement-breakpoint
CREATE INDEX "submission_contest_question_idx" ON "submission" USING btree ("contest_question_id");--> statement-breakpoint
CREATE INDEX "submission_question_idx" ON "submission" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "submission_user_idx" ON "submission" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "question_status_idx" ON "question" USING btree ("status");--> statement-breakpoint
CREATE INDEX "question_created_by_idx" ON "question" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "question_category_id_idx" ON "question" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "assignment_question_id_idx" ON "question_assignment" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "assignment_reviewer_id_idx" ON "question_assignment" USING btree ("reviewer_id");--> statement-breakpoint
CREATE INDEX "assignment_status_idx" ON "question_assignment" USING btree ("status");--> statement-breakpoint
CREATE INDEX "question_version_question_id_idx" ON "question_version" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "review_comment_question_id_idx" ON "review_comment" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "review_comment_assignment_id_idx" ON "review_comment" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "topic_category_id_idx" ON "topic" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "audit_log_user_id_idx" ON "audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_log_action_idx" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "user_api_key_user_id_idx" ON "user_api_key" USING btree ("user_id");