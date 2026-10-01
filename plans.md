# Implementation Plans Log

> Log of incremental implementation plans with status tags (`[EXECUTED]` or `[CANCELLED]`).

---

# Implementation Plan: Contests and Multi-type Problems (MCQ, Text, Code)

This plan details the addition of full support for creating contests and problems of three types (`mcq`, `text`, and `code`), executing student programming submissions securely against the CodeBox engine, and providing a premium student workspace with split resizable panels and Monaco Editor.

---

## User Review Required

> [!IMPORTANT]
> **CodeBox Engine Connection**
> Code execution will be performed on the backend by connecting to a self-hosted CodeBox server (Judge0 compatible). We will configure the connection URL and Auth Token using environment variables: `CODEBOX_URL` (defaulting to `http://localhost:3000`) and `CODEBOX_TOKEN` (defaulting to `dev-token`).
> You will need to ensure that the CodeBox instance is running when testing code-based execution.

> [!NOTE]
> **Dependency Additions**
> We will add `@monaco-editor/react` to support rendering the code editor in the student attempt view.

---

## Open Questions

1. **How do we evaluate text-based questions?**
   Should we perform a case-insensitive trim-matched comparison, or strict matching? We propose: trim whitespace and compare case-insensitively.
2. **Should we support running partial/sample test cases without saving?**
   Yes, we propose a "Run Code" button that executes the code against sample test cases and displays the stdout/stderr, and a "Submit Code" button that executes it against all test cases, records the submission in the DB, and calculates the score.

---

## Proposed Changes

### 1. Database Schema

#### [MODIFY] [contest-schema.ts](file:///d:/contest-platform/src/server/db/contest-schema.ts)

- Update `question` table:
  - Add `starterCode` column: `jsonb("starter_code")` to store boilerplate template per language ID.
  - Add `allowedLanguages` column: `jsonb("allowed_languages")` to restrict language IDs.
  - Add `timeLimit` column: `integer("time_limit")` (default 5 seconds).
  - Add `memoryLimit` column: `integer("memory_limit")` (default 128000 KB).
- Create `testCase` table:
  - `id`: text primary key
  - `questionId`: text, references `question.id` (cascade delete)
  - `input`: text
  - `expectedOutput`: text
  - `isSample`: boolean, default `false` (shown to students in problem description)
- Create `submission` table:
  - `id`: text primary key
  - `contestParticipationId`: text, references `contest_participation.id` (cascade delete)
  - `questionId`: text, references `question.id` (cascade delete)
  - `userId`: text, references `user.id` (cascade delete)
  - `userAnswer`: text (contains option selected, text typed, or code source)
  - `languageId`: integer (for code type)
  - `status`: text (e.g. `"Accepted"`, `"Wrong Answer"`, `"Runtime Error"`, `"Compilation Error"`, `"Time Limit Exceeded"`, `"Incorrect"`, `"Correct"`)
  - `scoreObtained`: integer (score earned for this submission)
  - `executionResult`: jsonb (holds compilation logs and testcase-by-testcase pass/fail statuses)
  - `createdAt`: timestamp (defaults to current time)
- Update relations:
  - Update `questionRelations` to link to `testCase` and `submission`
  - Update `contestParticipationRelations` to link to `submission`
  - Create new `testCaseRelations` and `submissionRelations`

---

### 2. tRPC Routers

#### [MODIFY] [contest.ts](file:///d:/contest-platform/src/server/trpc/routers/contest.ts)

Add endpoints for Admin Management & Student Attempts:

- **Admin Procedures** (restricted to `role: "admin"`):
  - `createContest`: insert new contest.
  - `updateContest`: update contest details.
  - `getContestForEdit`: retrieve contest along with its questions and test cases.
  - `addQuestion`: add a new MCQ, Text, or Code question to a contest.
  - `updateQuestion`: update question metadata, starter code templates, and test cases.
  - `deleteQuestion`: remove question and its associated test cases.
- **Student Attempt Procedures**:
  - `submitMcqOrTextAnswer`: saves or updates the student's answer for MCQ or Text questions as a submission record.
  - `runCode`: calls CodeBox API to test code against sample test cases (no DB write).
  - `submitCode`: runs student code against all test cases, creates a submission record, and computes correctness.
  - `finishAttempt`: marks the attempt as completed, scoring the student based on the highest scored submission for each question in the contest.

---

### 3. Frontend UI

#### [MODIFY] [page.tsx](file:///d:/contest-platform/src/app/dashboard/page.tsx)

- Upgrade the Admin Dashboard:
  - List existing contests.
  - Add a "Create Contest" modal or button redirecting to the creation page.
  - Click on a contest to navigate to its management console.

#### [NEW] [page.tsx](file:///d:/contest-platform/src/app/dashboard/contests/new/page.tsx)

- Clean, premium form to create a new contest (title, code, start time, end time, duration, total score, total time).

#### [NEW] [page.tsx](file:///d:/contest-platform/src/app/dashboard/contests/[id]/page.tsx)

- Contest management dashboard displaying:
  - Contest summary metrics.
  - List of existing questions.
  - "Add Question" buttons for MCQ, Text, or Code.

#### [NEW] [page.tsx](file:///d:/contest-platform/src/app/dashboard/contests/[id]/questions/new/page.tsx)

- Question authoring form. Dynamically adapts based on question type:
  - **MCQ**: options array builder, correct option dropdown.
  - **Text**: correct answer input field.
  - **Code**: fields for memory/time limits, test case input/output list builder (with sample checkbox), and starter code editor for languages (Python, JavaScript, Java, C++).

#### [NEW] [page.tsx](file:///d:/contest-platform/src/app/dashboard/contests/[id]/questions/[questionId]/page.tsx)

- Question edit form (analogous to the new question page, preloaded with existing question data).

#### [MODIFY] [page.tsx](file:///d:/contest-platform/src/app/contest/[code]/attempt/page.tsx)

- Transform the attempt workspace into a high-fidelity editor:
  - Left panel: Question text, score value, and sample test cases.
  - Right panel: Resizable interface containing:
    - Language selector dropdown.
    - Monaco Editor instance with syntax highlighting, synced with starter templates.
    - Console output terminal showing test execution results (pass/fail, stdout, stderr, run time, memory consumption).
    - "Run Code" and "Submit Code" buttons.
  - For MCQ/Text questions, render standard options or text field with a "Save Answer" button that persists progress immediately.

---

### 4. Configuration and Environment

#### [NEW] [codebox.ts](file:///d:/contest-platform/src/server/codebox.ts)

- Helper class to call CodeBox API:
  - Handles `/submissions?wait=true` requests.
  - Decodes base64 outputs if necessary.
  - Evaluates matching logic (whitespace trimming, case normalization).

#### [MODIFY] [seed.ts](file:///d:/contest-platform/src/server/db/seed.ts)

- Update seed file to populate:
  - Admin & student accounts.
  - A sample contest with one MCQ, one Text, and one Code question (e.g. "Two Sum" or "Palindromic Number" with templates and sample test cases).

---

## Verification Plan

### Automated Tests

- Build and compile check: `pnpm tsc`
- Database migration sync: `pnpm db:push`
- Verify DB seed execution: `pnpm db:seed`

### Manual Verification

- Log in as admin, create a contest, and add MCQ, Text, and Code questions.
- Configure starter code and sample/private test cases.
- Log in as student, attempt the contest:
  - Fill MCQ and Text questions and save answers.
  - Select Python/JavaScript for the Code question, write correct/incorrect code, and execute "Run Code".
  - Click "Submit Code" to test execution scoring.
  - Finish the attempt and verify the leaderboard and individual scoreboard are correctly populated.

---

# Question Lifecycle & Review System — Implementation Plan (v4)

## Decisions (All Resolved)

| Decision               | Answer                                                                                                                             |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Multi-role             | JSON array on user table (`roles: jsonb`)                                                                                          |
| Self-review            | Allowed                                                                                                                            |
| Categories/Topics      | Managed tables                                                                                                                     |
| Migration              | Fresh re-seed, no migration                                                                                                        |
| Reviewer assignment    | Creator picks reviewer                                                                                                             |
| Draft vs Version       | **`question.currentDraft` is mutable working copy. `questionVersion` is immutable snapshot minted strictly on `submitForReview`.** |
| Initial Question State | `status = "DRAFT"`, `currentVersionId = null`, NO version row created until first submit.                                          |
| Test cases             | **JSONB inside `question.currentDraft` and `questionVersion`**, no separate table                                                  |
| Assignment model       | **References `versionId`** — reviewer reviews a specific version snapshot                                                          |
| MCQ options            | **Structured with stable IDs** (`[{ id: "a", text: "..." }]`)                                                                      |
| Reviewer pick-up       | **Atomic DB update** to prevent race conditions                                                                                    |
| Ownership checks       | **Enforced at procedure level**, not just role middleware                                                                          |
| ACID Transactions      | **Strict `db.transaction()` boundaries** around all multi-step operations                                                          |

---

## Architecture

### Target Schema Diagram

```
                    QUESTION (identity + lifecycle)
                       │
                       ├── status ("DRAFT", "SUBMITTED_FOR_REVIEW", ...)
                       ├── currentDraft (jsonb: mutable working draft)
                       └── currentVersionId (nullable FK -> latest submitted version)
                                 │
                                 ↓
          ┌─── QUESTION VERSION (immutable content snapshot) ───┐
          │     Minted ONLY on submitForReview (V1, V2, ...)     │
          │     title, description, options, correctOptionId,   │
          │     hint, testCases[], starterCode, limits...       │
          │                                                     │
          │                                                     │
    QUESTION ASSIGNMENT ◄───────────────────────────────────────┘
          │     questionId
          │     versionId (exact version under review)
          │     reviewerId
          │     status ("PENDING", "IN_REVIEW", "COMPLETED")
          │
          ↓
    REVIEW COMMENT (threaded conversation)
          │
          ↓
    ┌───────────────────────────────────────────────────────────┐
    │                                                           │
    ↓                                                           ↓
CONTEST QUESTION (snapshot)                                AUDIT LOG
    contestId                                              userId
    questionId                                             action
    questionVersionId ──► immutable reference              entityType
    marks, order                                           entityId
    │                                                      metadata
    ↓
SUBMISSION (contest execution)

CATEGORY ──1:N──► TOPIC (managed taxonomy)

USER
  ├── roles: ["admin", "creator", "reviewer", "student"]
  └── status: "ACTIVE" | "INACTIVE"
```

### Question Lifecycle & Draft vs Version Flow

```
Creator creates question
      ↓
   DRAFT (currentDraft initialized, currentVersionId = null, NO questionVersion row yet)
      ↓
Creator edits draft freely (updates question.currentDraft, zero noise in version history)
      ↓ submitForReview [TX] (picks reviewer)
         1. Reads currentDraft
         2. Inserts questionVersion (V1)
         3. Sets question.currentVersionId = V1.id, status = SUBMITTED_FOR_REVIEW
         4. Inserts questionAssignment (versionId = V1.id, status = PENDING)
         5. Inserts auditLog
      ↓
SUBMITTED_FOR_REVIEW
      ↓ reviewer picks up [TX] (atomic: UPDATE assignment SET status='IN_REVIEW' WHERE status='PENDING')
  UNDER_REVIEW
      ↓
 ┌────────────────────────────────────────────────────────┐
 ↓                                ↓                       ↓
APPROVED [TX]            CHANGES_REQUESTED [TX]         REJECTED [TX] (terminal)
(status=APPROVED,        (status=CHANGES_REQUESTED,     (mandatory reason comment,
 ready for contests)      mandatory review comment,      assignment completed)
                          assignment completed)
                                  ↓
                        Creator inspects comments
                        & modifies question.currentDraft
                                  ↓
                        submitForReview [TX]
                         1. Reads updated currentDraft
                         2. Inserts questionVersion (V2)
                         3. Sets currentVersionId = V2.id, status = SUBMITTED_FOR_REVIEW
                         4. Inserts new questionAssignment (versionId = V2.id)
                         5. Inserts auditLog
                                  ↓
                        Cycle continues...

Any status ──admin──► ARCHIVED (cannot be added to new contests, existing contest snapshots unaffected)
```

---

## Database Schema

---

### [MODIFY] [auth-schema.ts](file:///d:/contest-platform/src/server/db/auth-schema.ts)

```diff
-  role: text("role").notNull().$default(() => "student"),
+  roles: jsonb("roles").notNull().$default(() => ["student"]),
+  status: text("status").notNull().default("ACTIVE"),
```

> [!NOTE]
> Better-auth config and procedures will check `user.roles.includes(...)`.

---

### [NEW] `question-bank-schema.ts`

#### `category` table

| Column      | Type                 | Notes                  |
| ----------- | -------------------- | ---------------------- |
| `id`        | text PK              |                        |
| `name`      | text NOT NULL UNIQUE | e.g. "DSA", "Aptitude" |
| `createdAt` | timestamp            |                        |

#### `topic` table

| Column       | Type               | Notes                      |
| ------------ | ------------------ | -------------------------- |
| `id`         | text PK            |                            |
| `categoryId` | text FK → category |                            |
| `name`       | text NOT NULL      | e.g. "Arrays", "Trees"     |
| `createdAt`  | timestamp          |                            |
|              |                    | `UNIQUE(categoryId, name)` |

#### `question` table — **Identity, Lifecycle & Mutable Working Draft**

| Column             | Type                            | Notes                                                                                                                |
| ------------------ | ------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `id`               | text PK                         |                                                                                                                      |
| `questionType`     | text NOT NULL                   | `"mcq"` \| `"text"` \| `"code"` (immutable)                                                                          |
| `categoryId`       | text FK → category              |                                                                                                                      |
| `topicId`          | text FK → topic                 |                                                                                                                      |
| `difficulty`       | text NOT NULL                   | `"easy"` \| `"medium"` \| `"hard"`                                                                                   |
| `status`           | text NOT NULL DEFAULT `"DRAFT"` | `DRAFT` \| `SUBMITTED_FOR_REVIEW` \| `UNDER_REVIEW` \| `CHANGES_REQUESTED` \| `APPROVED` \| `REJECTED` \| `ARCHIVED` |
| `currentVersionId` | text FK → questionVersion       | `NULL` until first submission; points to latest submitted/approved version snapshot                                  |
| `currentDraft`     | jsonb NOT NULL                  | Current editable working draft content (see structure below)                                                         |
| `createdById`      | text FK → user                  |                                                                                                                      |
| `createdAt`        | timestamp                       |                                                                                                                      |
| `updatedAt`        | timestamp                       |                                                                                                                      |

**`currentDraft` JSONB Structure:**

```typescript
interface QuestionDraftContent {
  title: string;
  description: string;
  options?: { id: string; text: string }[] | null;
  correctOptionId?: string | null;
  hint?: string | null;
  questionScore: number;
  starterCode?: Record<string, string> | null;
  allowedLanguages?: number[] | null;
  timeLimit?: number; // default 5s
  memoryLimit?: number; // default 128000 KB
  testCases?:
    | { input: string; expectedOutput: string; isSample: boolean }[]
    | null;
}
```

#### `questionVersion` table — **Immutable Content Snapshots**

Minted **only** upon `submitForReview`. Never directly updated after creation.

| Column             | Type                       | Notes                                    |
| ------------------ | -------------------------- | ---------------------------------------- |
| `id`               | text PK                    |                                          |
| `questionId`       | text FK → question CASCADE |                                          |
| `version`          | integer NOT NULL           | `1, 2, 3...` sequentially per question   |
| `title`            | text NOT NULL              |                                          |
| `description`      | text NOT NULL              |                                          |
| `options`          | jsonb                      | structured: `[{ id: "a", text: "..." }]` |
| `correctOptionId`  | text                       | matches option `id`                      |
| `hint`             | text                       |                                          |
| `questionScore`    | integer NOT NULL           |                                          |
| `starterCode`      | jsonb                      | `{ "71": "import sys...", ... }`         |
| `allowedLanguages` | jsonb                      | `[50, 54, 62, ...]`                      |
| `timeLimit`        | integer DEFAULT 5          | seconds                                  |
| `memoryLimit`      | integer DEFAULT 128000     | KB                                       |
| `testCases`        | jsonb                      | `[{ input, expectedOutput, isSample }]`  |
| `createdById`      | text FK → user             | author of this version                   |
| `createdAt`        | timestamp                  |                                          |
|                    |                            | `UNIQUE(questionId, version)`            |

#### `questionAssignment` table

| Column         | Type                              | Notes                                                  |
| -------------- | --------------------------------- | ------------------------------------------------------ |
| `id`           | text PK                           |                                                        |
| `questionId`   | text FK → question CASCADE        |                                                        |
| `versionId`    | text FK → questionVersion         | **specific version being reviewed**                    |
| `reviewerId`   | text FK → user                    |                                                        |
| `assignedById` | text FK → user                    | creator who assigned                                   |
| `assignedAt`   | timestamp NOT NULL                |                                                        |
| `status`       | text NOT NULL DEFAULT `"PENDING"` | `PENDING` \| `IN_REVIEW` \| `COMPLETED` \| `CANCELLED` |
| `completedAt`  | timestamp                         |                                                        |

#### `reviewComment` table

| Column         | Type                                 | Notes                 |
| -------------- | ------------------------------------ | --------------------- |
| `id`           | text PK                              |                       |
| `questionId`   | text FK → question CASCADE           |                       |
| `assignmentId` | text FK → questionAssignment CASCADE |                       |
| `userId`       | text FK → user                       | author of the comment |
| `message`      | text NOT NULL                        |                       |
| `createdAt`    | timestamp NOT NULL                   |                       |

---

### [MODIFY] [contest-schema.ts](file:///d:/contest-platform/src/server/db/contest-schema.ts)

**Remove:** `question` table, `testCase` table, and their relations.

**Add `contestQuestion` join table:**

| Column              | Type                               | Notes                              |
| ------------------- | ---------------------------------- | ---------------------------------- |
| `id`                | text PK                            |                                    |
| `contestId`         | text FK → contest CASCADE          |                                    |
| `questionId`        | text FK → question CASCADE         |                                    |
| `questionVersionId` | text FK → questionVersion NOT NULL | **the immutable snapshot**         |
| `marks`             | integer NOT NULL                   | contest-specific score             |
| `questionOrder`     | integer NOT NULL                   |                                    |
|                     |                                    | `UNIQUE(contestId, questionId)`    |
|                     |                                    | `UNIQUE(contestId, questionOrder)` |

**Update `submission`:**

```diff
-  questionId: text FK → question.id
+  contestQuestionId: text FK → contestQuestion.id
+  questionId: text FK → question.id  // denormalized convenience reference
```

---

### [NEW] `audit-schema.ts`

| Column       | Type               | Notes                                                                                                                                |
| ------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `id`         | text PK            |                                                                                                                                      |
| `userId`     | text FK → user     |                                                                                                                                      |
| `action`     | text NOT NULL      | `QUESTION_CREATED`, `QUESTION_SUBMITTED`, `REVIEW_PICKED_UP`, `CHANGES_REQUESTED`, `REVIEW_APPROVED`, `CONTEST_QUESTION_ADDED`, etc. |
| `entityType` | text NOT NULL      | `"question"`, `"assignment"`, `"contest"`, `"user"`                                                                                  |
| `entityId`   | text NOT NULL      |                                                                                                                                      |
| `metadata`   | jsonb              |                                                                                                                                      |
| `createdAt`  | timestamp NOT NULL |                                                                                                                                      |

Indexes: `(entityType, entityId)`, `(userId)`, `(createdAt)`

---

### [MODIFY] [schema.ts](file:///d:/contest-platform/src/server/db/schema.ts)

```typescript
export * from "./auth-schema";
export * from "./contest-schema";
export * from "./question-bank-schema";
export * from "./audit-schema";
```

---

## Permissions & Auth

### [MODIFY] [permissions.ts](file:///d:/contest-platform/src/lib/permissions.ts)

```typescript
export const statement = {
  contest: ["create", "update", "delete", "view"],
  question: ["create", "update", "submit_for_review", "view"],
  review: ["pick_up", "approve", "reject", "request_changes", "comment"],
  submission: ["create", "view"],
  user: ["manage_roles", "deactivate"],
  category: ["create", "update", "delete", "view"],
} as const;

// student:   contest.view, submission.*
// creator:   question.*, review.comment, category.view
// reviewer:  review.*, question.view, category.view
// admin:     everything
```

### [MODIFY] [auth.ts](file:///d:/contest-platform/src/server/auth.ts)

Register `creator` and `reviewer` roles alongside `admin` and `student`.

---

## tRPC Layer & Transaction Boundaries

### [MODIFY] [init.ts](file:///d:/contest-platform/src/server/trpc/init.ts)

- `adminMiddleware` → `ctx.session?.user?.roles?.includes("admin")`
- Add `creatorProcedure` → checks `roles.includes("creator")`
- Add `reviewerProcedure` → checks `roles.includes("reviewer")`
- Add `creatorOrReviewerProcedure` → checks either role

---

### [NEW] `routers/question-bank.ts`

All multi-step operations execute inside `await ctx.db.transaction(async (tx) => { ... })`.

#### Creator Endpoints

| Procedure         | Auth             | Transaction & Logic                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create`          | creator          | Inserts into `question` with `status = "DRAFT"`, `currentVersionId = null`, `currentDraft = input`. Inserts `auditLog`. Returns question.                                                                                                                                                                                                                                                                                                                                                                         |
| `updateDraft`     | creator          | Ownership check (`createdById === ctx.user.id`). Verifies status is `DRAFT` or `CHANGES_REQUESTED`. Updates `currentDraft` and `updatedAt`.                                                                                                                                                                                                                                                                                                                                                                       |
| `submitForReview` | creator          | **Inside `tx`:**<br>1. Ownership check (`createdById === ctx.user.id`) and status check (`DRAFT` or `CHANGES_REQUESTED`).<br>2. Fetch max version for question: `nextVer = (maxVer ?? 0) + 1`.<br>3. Insert into `questionVersion` copying from `currentDraft`.<br>4. Update `question` (`currentVersionId = newVersion.id`, `status = "SUBMITTED_FOR_REVIEW"`).<br>5. Insert `questionAssignment` (`versionId = newVersion.id`, `reviewerId = input.reviewerId`, `status = "PENDING"`).<br>6. Insert `auditLog`. |
| `listMyQuestions` | creator          | Filter by `createdById = ctx.user.id`, optional status filter.                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `getQuestion`     | creator/reviewer | Fetch question with `currentDraft`, version history, active assignment, and comment thread. Ownership check ensures only creator, assigned reviewer, or admin can access.                                                                                                                                                                                                                                                                                                                                         |

#### Reviewer Endpoints

| Procedure         | Auth             | Transaction & Logic                                                                                                                                                                                                                                                                                                    |
| ----------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `listAssigned`    | reviewer         | `questionAssignment` where `reviewerId = ctx.user.id` and `status IN ("PENDING", "IN_REVIEW")`.                                                                                                                                                                                                                        |
| `listHistory`     | reviewer         | Completed / rejected reviews by this reviewer.                                                                                                                                                                                                                                                                         |
| `pickUpForReview` | reviewer         | **Inside `tx`:**<br>1. **Atomic update:** `UPDATE question_assignment SET status = 'IN_REVIEW' WHERE id = input.assignmentId AND reviewerId = ctx.user.id AND status = 'PENDING'`.<br>2. Throw if 0 rows affected (prevents race condition).<br>3. Update `question.status = "UNDER_REVIEW"`.<br>4. Insert `auditLog`. |
| `approve`         | reviewer         | **Inside `tx`:**<br>1. Verify assignment is `IN_REVIEW` and `reviewerId === ctx.user.id`.<br>2. Update assignment: `status = "COMPLETED"`, `completedAt = now()`.<br>3. Update `question.status = "APPROVED"`.<br>4. Optional comment into `reviewComment`.<br>5. Insert `auditLog`.                                   |
| `requestChanges`  | reviewer         | **Inside `tx`:**<br>1. Verify assignment is `IN_REVIEW` and `reviewerId === ctx.user.id`.<br>2. Insert mandatory reason into `reviewComment`.<br>3. Update assignment: `status = "COMPLETED"`, `completedAt = now()`.<br>4. Update `question.status = "CHANGES_REQUESTED"`.<br>5. Insert `auditLog`.                   |
| `reject`          | reviewer         | **Inside `tx`:**<br>1. Verify assignment is `IN_REVIEW` and `reviewerId === ctx.user.id`.<br>2. Insert mandatory reason into `reviewComment`.<br>3. Update assignment: `status = "COMPLETED"`, `completedAt = now()`.<br>4. Update `question.status = "REJECTED"`.<br>5. Insert `auditLog`.                            |
| `addComment`      | creator/reviewer | Verify user is question's creator or assigned reviewer. Insert into `reviewComment`.                                                                                                                                                                                                                                   |
| `getReviewThread` | creator/reviewer | Load comments for assignment/question with author details.                                                                                                                                                                                                                                                             |

#### Admin / Bank Endpoints

| Procedure           | Auth           | Description                                                                                                       |
| ------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------- |
| `listQuestionBank`  | admin          | Filterable: category, topic, difficulty, status, questionType, creator.                                           |
| `assignReviewer`    | admin          | Inside `tx`: reassigns reviewer on active assignment or creates new assignment, logs audit.                       |
| `archiveQuestion`   | admin          | Inside `tx`: sets `question.status = "ARCHIVED"`. Existing contest questions pointing to snapshots remain intact. |
| `getVersionHistory` | admin/reviewer | Returns all `questionVersion` snapshots for a question.                                                           |

---

### [NEW] `routers/taxonomy.ts`

| Procedure        | Auth          | Description                            |
| ---------------- | ------------- | -------------------------------------- |
| `listCategories` | authenticated | All categories with topics.            |
| `createCategory` | admin         | Add category.                          |
| `updateCategory` | admin         | Rename category.                       |
| `deleteCategory` | admin         | Delete (verifies no questions linked). |
| `listTopics`     | authenticated | Filterable by category.                |
| `createTopic`    | admin         | Add topic.                             |
| `updateTopic`    | admin         | Rename topic.                          |
| `deleteTopic`    | admin         | Delete (verifies no questions linked). |

---

### [MODIFY] [routers/contest.ts](file:///d:/contest-platform/src/server/trpc/routers/contest.ts)

Key changes with transactions:

- **`addQuestion`** (now from bank):
  Inside `tx`:
  1. Fetch question, verify `status === "APPROVED"` and `currentVersionId` exists.
  2. Fetch version snapshot: `questionVersion.id === question.currentVersionId`.
  3. Insert into `contestQuestion` (`contestId`, `questionId`, `questionVersionId`, `marks: input.marks ?? version.questionScore`, `questionOrder`).
  4. Update contest `totalQuestions` and `totalScore`.
  5. Insert `auditLog`.
- **`removeQuestion`**:
  Inside `tx`:
  1. Delete `contestQuestion`.
  2. Reorder remaining questions.
  3. Recalculate contest `totalQuestions` and `totalScore`.
  4. Insert `auditLog`.
- **Student-facing** (`getByCode`, `submitMcqOrTextAnswer`, `runCode`, `submitCode`):
  Read question content & test cases directly from `contestQuestion.questionVersion`.
- **`finishAttempt`**:
  Aggregate scores over `contestQuestion` records.

---

### [NEW] `routers/admin.ts`

| Procedure       | Auth  | Description                                                          |
| --------------- | ----- | -------------------------------------------------------------------- |
| `listUsers`     | admin | Paginated user list with role & status filters.                      |
| `addRole`       | admin | Appends role to user's `roles` array (atomic in `tx`, logs audit).   |
| `removeRole`    | admin | Removes role (prevents empty role list, atomic in `tx`, logs audit). |
| `setUserStatus` | admin | `ACTIVE` ↔ `INACTIVE` (atomic in `tx`, logs audit).                  |
| `getAuditLog`   | admin | Paginated log table with action/entity/date filters.                 |

---

### [MODIFY] [root.ts](file:///d:/contest-platform/src/server/trpc/root.ts)

```typescript
export const appRouter = createTRPCRouter({
  contest: contestRouter,
  questionBank: questionBankRouter,
  taxonomy: taxonomyRouter,
  admin: adminRouter,
});
```

---

## Frontend Pages

### [NEW] `/dashboard/questions/` — Creator Dashboard

- Filter tabs: **All** | **Drafts** | **In Review** | **Changes Requested** | **Approved**
- Question cards: title, type, category/topic, difficulty badge, status badge
- Draft editor: dynamic fields (MCQ with structured option items and radio for correct ID, code with embedded test case builder + starter code)
- Submit modal: dropdown of available reviewers (users with "reviewer" role)

### [NEW] `/dashboard/reviews/` — Reviewer Dashboard

- Tabs: **Assigned** | **Active Threads** | **History**
- Metrics header: Pending Reviews, In Review, Completed, Changes Requested
- Review viewer: displays current version snapshot, diff against previous version (if re-submission), and threaded review comments
- Action buttons: "Pick up", "Approve", "Request Changes" (with comment prompt), "Reject" (with reason prompt)

### [MODIFY] `/dashboard/contests/[id]/` — Contest Editor

- "Add from Question Bank" modal: filter approved questions by category, topic, difficulty, type
- Displays version snapshot tag (e.g. `v2`)
- Custom marks & order per question

### [NEW] `/dashboard/admin/users/` — User Management

- User table with role badges, status toggle
- Edit role dialog with checkboxes (`admin`, `creator`, `reviewer`, `student`)

### [NEW] `/dashboard/admin/categories/` — Taxonomy Management

- Category & topic manager with modal CRUD

### [NEW] `/dashboard/admin/audit/` — Audit Log

- Searchable, filterable audit trail

---

## Seed Script

### [MODIFY] [seed.ts](file:///d:/contest-platform/src/server/db/seed.ts)

1. Create admin user (`roles: ["admin"]`)
2. Create creator+reviewer user (`roles: ["creator", "reviewer"]`) — self-review scenario
3. Create student user (`roles: ["student"]`)
4. Create categories ("DSA", "Aptitude") and topics ("Arrays", "Strings", "Logical Reasoning")
5. Create 3 sample questions:
   - MCQ with structured options (`[{ id: "a", text: "O(n²)" }, ...]`), correctOptionId: `"a"`
   - Text question
   - Code question with embedded test cases
6. Submit and approve them into `questionVersion` (V1)
7. Create sample contest linking to these V1 snapshots via `contestQuestion`
8. Populate audit log entries

---

## Verification Plan

### Automated

```bash
pnpm db:push          # schema pushes cleanly to Postgres
pnpm db:seed          # seed runs without errors, populating full lifecycle
pnpm build            # Next.js compiles with zero type errors
```

### Manual Walkthrough

1. **Initial Draft**: Creator creates question → `status = "DRAFT"`, `currentVersionId = null`, no version row created.
2. **Draft Editing**: Creator edits draft → `currentDraft` updated, no version rows created.
3. **Submission (TX)**: Creator submits (picks self as reviewer) → V1 minted in `questionVersion`, assignment created, status → `SUBMITTED_FOR_REVIEW`.
4. **Atomic Pick Up (TX)**: Reviewer picks up → status → `UNDER_REVIEW`. Concurrent attempt fails cleanly.
5. **Changes Requested (TX)**: Reviewer requests change with comment → status → `CHANGES_REQUESTED`.
6. **Re-submit (TX)**: Creator edits `currentDraft`, submits again → V2 minted in `questionVersion`, new assignment created, status → `SUBMITTED_FOR_REVIEW`.
7. **Approval (TX)**: Reviewer approves → status → `APPROVED`, `currentVersionId = V2.id`.
8. **Contest Snapshot (TX)**: Contest adds approved question → `contestQuestion` references V2.
9. **Immutability Check**: Creator edits draft for a future V3 → contest attempt continues running against unchanged V2 snapshot.
10. **Audit Log Check**: Verify every lifecycle step has an associated `auditLog` row.

---

# [EXECUTED] Reviewer Desk Enhancement: Table View, Accurate Status & Review Chat

Enhance the Reviewer Desk (`/dashboard/reviews`) to display reviews in a structured dashboard-style table, fix the status display in Review History so it shows **"Changes Requested"** (amber badge) instead of "COMPLETED", and display the full review conversation / chat thread (feedback messages, creator replies, timestamps, role badges) with interactive reply capability when any question is clicked.

## Key Design Principles

> [!NOTE]
>
> - **Unified Question Entity**: All discussion and feedback comments are tied to `questionId`. A question transitions through states (`CHANGES_REQUESTED`, `APPROVED`, `REJECTED`), and its full conversation history remains continuous across revisions.
> - **No Database Migration Needed**: `a.question.status` already tracks the true status (`CHANGES_REQUESTED`, `APPROVED`, etc.). The previous issue was that the UI was reading assignment status `a.status` ("COMPLETED") instead of the question's status.

---

## Proposed Changes

### Backend: Question Bank Router

#### [MODIFY] [question-bank.ts](file:///d:/contest-platform/src/server/trpc/routers/question-bank.ts)

- In `listHistory`:
  - Ensure the query orders assignments by `completedAt` descending.
  - Deduplicate by `questionId` if a question was submitted multiple times, showing the latest review record per question.
  - Include question details, category, topic, creator, reviewer, and version.

---

### Frontend: Review Desk Page

#### [MODIFY] [reviews/page.tsx](file:///d:/contest-platform/src/app/dashboard/reviews/page.tsx)

- **Dashboard-Style Table**:
  - Replace the narrow left card-stack with a full-width structured table matching the main dashboard styling.
  - Table headers:
    - **Question Title** (with type and version badge)
    - **Type** (MCQ, Code, Text)
    - **Version** (`v1`, `v2`, etc.)
    - **Category / Topic** (e.g., `Algorithms • Dynamic Programming`)
    - **Creator** (name and email)
    - (Admin view: **Reviewer**)
    - **Assigned / Reviewed Date**
    - **Status** (accurate badge)
    - **Action** (e.g. "Review & Inspect" / "View Review & Chat")
  - Add search bar to quickly filter by question title, creator, or topic.
- **Accurate Review Status Badges**:
  - In Review History:
    - `CHANGES_REQUESTED` → Amber badge: **Changes Requested**
    - `APPROVED` → Green badge: **Approved**
    - `REJECTED` → Red badge: **Rejected**
    - `CANCELLED` → Muted badge: **Cancelled**
  - In Assigned Reviews:
    - `PENDING` → Yellow badge: **Pending Pickup**
    - `IN_REVIEW` → Blue badge: **In Review**
- **Question Inspection & Chat Modal**:
  - Clicking any row or action opens a comprehensive dialog (`max-w-6xl w-[96vw]`):
    - **Header**: Question title, version, question type, status badge, and reviewer action buttons (`Approve`, `Request Changes`, `Reject`) if currently `IN_REVIEW`.
    - **Left Column**: Question Specifications
      - Problem statement rendered with `MarkdownRenderer` (supporting markdown formatting and responsive image URLs).
      - MCQ options with correct answer indicated (if MCQ).
      - Time/memory constraints and configured test cases (if Code).
      - Hints and points score.
    - **Right Column**: Review Discussion & Chat Thread
      - Status summary banner (e.g., highlighting that changes were requested).
      - Threaded chat stream: The reviewer's feedback message, creator's replies, timestamps, user avatars/badges ("Reviewer" vs "Creator").
      - Interactive reply input: Textarea + "Send Reply" button to send messages to the creator.
- **Mutation & Query Synchronization**:
  - Refetch both `assignedList` and `historyList` whenever an action is performed (`requestChanges`, `approve`, `reject`, `addComment`).
  - Toast confirmation notifications (e.g., "Changes requested. Question moved to Review History.").

---

## Verification Plan

### Automated Tests

- Run `pnpm exec tsc --noEmit` to verify 0 TypeScript errors.

### Manual Verification

1. Navigate to `/dashboard/reviews`.
2. Verify the table renders matching dashboard styling with all columns.
3. Switch between **Assigned Reviews** and **Review History** tabs.
4. Verify questions with changes requested show the amber **"Changes Requested"** badge instead of "COMPLETED".
5. Click on any question row to open the inspection dialog.
6. Verify problem description and test cases/MCQ options render correctly.
7. Verify the review feedback message and conversation thread appear in the chat panel.
8. Type a message in the reply box and click "Send Reply", confirming the new comment appears in the thread.
9. For an active assignment in `IN_REVIEW`, click "Request Changes", enter feedback, submit, and confirm it moves to Review History with the amber "Changes Requested" badge and the comment appears in the chat thread.

---

# [EXECUTED] # Implementation Plan: Admin Direct Review & Approval of Draft Questions (v2)

Enable administrators to directly approve question drafts into the Question Bank (`APPROVED`) without requiring an external reviewer roundtrip, while preserving data validation, version snapshot minting, audit trail, and contest compatibility.

> [!NOTE]
> **v2 changes** — Updated based on review feedback:
>
> 1. **Cancel + Create** assignment pattern instead of mutating existing assignments (matches existing `assignReviewer` precedent).
> 2. **Shared `validateQuestionDraft()`** function extracted for use by both `submitForReview` and `directApproveDraft`.
> 3. **UI scope expanded** — "Approve to Question Bank" button shown for all four pre-approved statuses (`DRAFT`, `CHANGES_REQUESTED`, `SUBMITTED_FOR_REVIEW`, `UNDER_REVIEW`).
> 4. **Wording** — "Approve to Question Bank" instead of "Approve Draft".

---

## User Review Required

> [!IMPORTANT]
> **Data Integrity & Version Snapshot Minting**
> Direct approval bypasses the peer-review waiting period, but it **MUST NOT** bypass data validation or versioning. When an Admin approves:
>
> 1. Content validation is strictly enforced via shared `validateQuestionDraft()` (MCQs: ≥2 options with unique IDs, correctOptionId exists in options, non-empty text; Code: ≥1 test case with input+expectedOutput).
> 2. An immutable `questionVersion` snapshot is minted from `currentDraft`, and `question.currentVersionId` is set. The question can be immediately added to Contests.
> 3. Any existing active assignment is **cancelled** (not mutated), then a new completed admin assignment is created. This preserves the original reviewer's audit trail.

> [!WARNING]
> **Confirmation dialog required** — The UI must show: _"This will approve the current draft and create an immutable question version. Any active peer-review assignment will be cancelled."_

---

## Proposed Changes

### 1. Shared Validation Utility

#### [MODIFY] [question-bank.ts](file:///d:/contest-platform/src/server/trpc/routers/question-bank.ts)

Extract a reusable validation function at the top of the file (below schema definitions):

```ts
function validateQuestionDraft(
  draft: QuestionDraftContent,
  questionType: string,
): void {
  if (!draft.title?.trim()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Title is required." });
  }
  if (!draft.description?.trim()) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Description is required.",
    });
  }

  if (questionType === "mcq") {
    if (!draft.options || draft.options.length < 2) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "MCQ must have at least 2 options.",
      });
    }
    // Validate option IDs are unique
    const ids = draft.options.map((o) => o.id);
    if (new Set(ids).size !== ids.length) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "MCQ option IDs must be unique.",
      });
    }
    // Validate option text is non-empty
    if (draft.options.some((o) => !o.text?.trim())) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "All MCQ options must have text.",
      });
    }
    if (!draft.correctOptionId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "MCQ must have a correct option.",
      });
    }
    // Validate correctOptionId exists in options
    if (!draft.options.some((o) => o.id === draft.correctOptionId)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "correctOptionId must match an option.",
      });
    }
  } else if (questionType === "code") {
    if (!draft.testCases || draft.testCases.length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Code question must have ≥1 test case.",
      });
    }
  }
}
```

Then update the existing inline validation in `submitForReview` (lines 205-225) to call `validateQuestionDraft(draft, target.questionType)` instead.

---

### 2. Backend: `directApproveDraft` Procedure

#### [MODIFY] [question-bank.ts](file:///d:/contest-platform/src/server/trpc/routers/question-bank.ts)

Add before `archiveQuestion` (around line 925):

```ts
directApproveDraft: adminProcedure
  .input(z.object({
    questionId: z.string(),
    comment: z.string().optional(),
  }))
  .mutation(async ({ ctx, input }) => {
    return await ctx.db.transaction(async (tx) => {
      // 1. Fetch and verify question
      const target = await tx.query.question.findFirst({
        where: eq(question.id, input.questionId),
      });
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Question not found." });
      if (!["DRAFT", "CHANGES_REQUESTED", "SUBMITTED_FOR_REVIEW", "UNDER_REVIEW"].includes(target.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Cannot approve from ${target.status}.` });
      }

      // 2. Validate draft content (shared function)
      const draft = target.currentDraft as QuestionDraftContent;
      validateQuestionDraft(draft, target.questionType);

      // 3. Mint immutable version snapshot
      const lastVersions = await tx.query.questionVersion.findMany({
        where: eq(questionVersion.questionId, target.id),
        orderBy: (qv, { desc }) => [desc(qv.version)],
        limit: 1,
      });
      const nextVersionNumber = (lastVersions[0]?.version ?? 0) + 1;
      const versionId = crypto.randomUUID();
      await tx.insert(questionVersion).values({
        id: versionId,
        questionId: target.id,
        version: nextVersionNumber,
        title: draft.title,
        description: draft.description,
        options: draft.options ?? null,
        correctOptionId: draft.correctOptionId ?? null,
        hint: draft.hint ?? null,
        questionScore: draft.questionScore ?? 10,
        starterCode: draft.starterCode ?? null,
        allowedLanguages: draft.allowedLanguages ?? null,
        timeLimit: draft.timeLimit ?? 5,
        memoryLimit: draft.memoryLimit ?? 128000,
        testCases: draft.testCases ?? null,
        createdById: ctx.user.id,
      });

      // 4. Cancel any active assignments (matches assignReviewer pattern)
      await tx
        .update(questionAssignment)
        .set({ status: "CANCELLED", completedAt: new Date() })
        .where(
          and(
            eq(questionAssignment.questionId, target.id),
            inArray(questionAssignment.status, ["PENDING", "IN_REVIEW"])
          )
        );

      // 5. Create new completed admin assignment
      const assignmentId = crypto.randomUUID();
      await tx.insert(questionAssignment).values({
        id: assignmentId,
        questionId: target.id,
        versionId: versionId,
        reviewerId: ctx.user.id,
        assignedById: target.createdById,
        status: "COMPLETED",
        completedAt: new Date(),
      });

      // 6. Update question status
      await tx.update(question).set({
        status: "APPROVED",
        currentVersionId: versionId,
        updatedAt: new Date(),
      }).where(eq(question.id, target.id));

      // 7. Review comment on the NEW admin assignment
      await tx.insert(reviewComment).values({
        id: crypto.randomUUID(),
        questionId: target.id,
        assignmentId: assignmentId,
        userId: ctx.user.id,
        message: input.comment?.trim() || "Reviewed and approved directly by Administrator.",
      });

      // 8. Audit log
      await tx.insert(auditLog).values({
        id: crypto.randomUUID(),
        userId: ctx.user.id,
        action: "ADMIN_DIRECT_APPROVED",
        entityType: "question",
        entityId: target.id,
        metadata: { version: nextVersionNumber, versionId, assignmentId },
      });

      return { success: true, versionId, version: nextVersionNumber, assignmentId };
    });
  }),
```

**Assignment history result** (e.g., question was under review by Rahul, admin overrides):

```
Q1
├── A1 → Rahul → CANCELLED       ← original assignment preserved
└── A2 → Admin → COMPLETED       ← new admin assignment
       └── reviewComment → "Approved directly..."
```

---

### 3. Shared Client-Side Role Helper

#### [NEW] [get-user-roles.ts](file:///d:/contest-platform/src/lib/get-user-roles.ts)

Extract the duplicated `getUserRoles` helper (currently inline in `dashboard/page.tsx:34` and `contests/layout.tsx:8`) into a shared client-safe utility:

```ts
export function getUserRoles(user: any): string[] {
  if (Array.isArray(user?.roles)) return user.roles;
  if (typeof user?.roles === "string") {
    try {
      const parsed = JSON.parse(user.roles);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [user.roles];
    }
  }
  if (user?.role && typeof user.role === "string") return [user.role];
  return ["student"];
}
```

Update imports in `dashboard/page.tsx` and `contests/layout.tsx` to use this shared version instead of their local copies.

---

### 4. Frontend: Question Detail Modal

#### [MODIFY] [question-detail-modal.tsx](file:///d:/contest-platform/src/app/dashboard/questions/question-detail-modal.tsx)

- Import `authClient` from `@/lib/auth-client` and `getUserRoles` from `@/lib/get-user-roles`.
- Add `useSession()` and derive `isAdmin`:
  ```ts
  const { data: session } = authClient.useSession();
  const isAdmin = getUserRoles(session?.user).includes("admin");
  ```
- Add `directApproveMutation` using `trpc.questionBank.directApproveDraft.mutationOptions()`.
- **In the modal header** (after status badge, around line 235):
  - When `isAdmin` and `q.status` is one of `DRAFT`, `CHANGES_REQUESTED`, `SUBMITTED_FOR_REVIEW`, `UNDER_REVIEW`:
    - Render an **"Approve to Question Bank"** button (green outline, CheckmarkCircle02Icon).
    - On click: show confirmation toast or inline confirm, then call mutation, toast success, `refetch()`.

---

### 5. Frontend: Questions Page Table

#### [MODIFY] [page.tsx](file:///d:/contest-platform/src/app/dashboard/questions/page.tsx)

- Import `getUserRoles` from `@/lib/get-user-roles`.
- Derive `isAdmin = getUserRoles(session?.user).includes("admin")`.
- In the table action column (around line 454-477):
  - When `isAdmin` and `q.status` is `DRAFT`, `CHANGES_REQUESTED`, `SUBMITTED_FOR_REVIEW`, or `UNDER_REVIEW`:
    - Add **"Approve to Question Bank"** button alongside existing "View & Review" and "Submit to Reviewer" buttons.
    - On click: call `directApproveDraft` mutation with confirmation dialog.

---

### 6. Frontend: Review Discussion Thread (Optional Enhancement)

#### [MODIFY] [review-discussion-thread.tsx](file:///d:/contest-platform/src/components/questions/review-discussion-thread.tsx)

- Accept optional `isAdmin` and `onDirectApprove` props.
- When `isAdmin` and question is in a pre-approved state, show a subtle admin action card in the banner area:
  > _"As administrator, you can directly approve this question into the Question Bank."_
  > **[Approve to Question Bank]**

---

## Verification Plan

### Automated Tests

```bash
pnpm exec tsc --noEmit
```

Expected: **0 type errors**.

### Manual Verification

1. Log in as Administrator.
2. Navigate to **Question Studio** (`/dashboard/questions`).
3. Verify **"Approve to Question Bank"** button appears on rows with status `DRAFT`, `CHANGES_REQUESTED`, `SUBMITTED_FOR_REVIEW`, or `UNDER_REVIEW`.
4. Click a draft row → open **Question Detail Modal** → verify the approve button in the header.
5. Click "Approve to Question Bank" → confirm the dialog.
6. Verify:
   - Success toast appears.
   - Status transitions to **Approved** (green badge).
   - Version tag updates to `v1` (or next version).
   - The approval comment appears in the review discussion thread.
7. **Test override scenario**: Submit a question for review (assign to another reviewer), then as admin directly approve it. Verify:
   - Original assignment status = `CANCELLED` (not mutated).
   - New admin assignment status = `COMPLETED`.
   - Both assignments visible in question history.
8. Navigate to **Contest Editor** → **Add from Question Bank** → verify the approved question is immediately listed.
9. Verify the `validateQuestionDraft` refactor by attempting to approve an MCQ with <2 options or missing `correctOptionId` — expect a clear error toast.

---

# [EXECUTED] # Implementation Plan: Admin Question Lifecycle Controls (Reject, Recover to Draft, Archive & Unarchive)

Enable administrators to have full governance over question lifecycles: hard-rejecting questions at any stage (with mandatory audit reason and cancel-and-create assignment preservation), recovering rejected questions back to `DRAFT` for creator revisions, and non-destructively shelving `APPROVED` questions via `ARCHIVED` with direct unarchive back to `APPROVED`.

---

## User Review Required

> [!IMPORTANT]
> **Semantic Distinctions & State Invariants**
>
> - **`REJECTED` is recoverable**: Moving a question to `REJECTED` halts all active peer-reviews and hides it from the Question Bank, but an Admin can transition it back to `DRAFT` so the creator can fix errors and resubmit.
> - **`ARCHIVED` is restricted to `APPROVED`**: Only previously approved questions can enter `ARCHIVED` (shelved from future contests without deletion).
> - **`ARCHIVED` recovers directly to `APPROVED`**: Because an archived question was already reviewed and approved, unarchiving it does not require re-review.
> - **Existing Contests Remain Intact**: `contestQuestion` records reference immutable `questionVersion` snapshots. Rejecting or archiving an approved question will **not** break contests that already reference that question version; it simply removes it from `listQuestionBank` for new contest curation.

> [!WARNING]
> **Rejection from pure DRAFT without `questionVersion`**
> For questions in `SUBMITTED_FOR_REVIEW`, `UNDER_REVIEW`, `CHANGES_REQUESTED`, or `APPROVED`, a `currentVersionId` exists, allowing the admin rejection to create a completed admin assignment and threaded `reviewComment`.
> For pure `DRAFT` questions that have never been submitted, no `questionVersion` exists yet. In this case, `adminReject` will update the question status to `REJECTED` and record the reason in the audit log (and draft metadata) without creating a phantom assignment.

---

## State Transition Matrix

| Action                | Current Status                                                                   | New Status | Who Can Perform | Assignment Effect                                                                         |
| --------------------- | -------------------------------------------------------------------------------- | ---------- | --------------- | ----------------------------------------------------------------------------------------- |
| `adminReject`         | `DRAFT`, `SUBMITTED_FOR_REVIEW`, `UNDER_REVIEW`, `CHANGES_REQUESTED`, `APPROVED` | `REJECTED` | Admin only      | Cancels active (`PENDING`/`IN_REVIEW`), creates completed admin assignment (if versioned) |
| `adminRestoreToDraft` | `REJECTED`                                                                       | `DRAFT`    | Admin only      | None (creator now owns the draft again)                                                   |
| `archiveQuestion`     | `APPROVED` only                                                                  | `ARCHIVED` | Admin only      | None (version remains intact)                                                             |
| `unarchiveQuestion`   | `ARCHIVED` only                                                                  | `APPROVED` | Admin only      | None (restores to active Question Bank pool)                                              |

---

## Proposed Changes

### 1. Backend: tRPC Router

#### [MODIFY] [question-bank.ts](file:///d:/contest-platform/src/server/trpc/routers/question-bank.ts)

- **Add `adminReject`**:
  - Guard: `adminProcedure`.
  - Input: `{ questionId: z.string(), reason: z.string().min(1, "Reason for rejection is required.") }`.
  - Validate target question exists and `status !== "ARCHIVED"` and `status !== "REJECTED"`.
  - If active assignments exist (`PENDING` or `IN_REVIEW`), cancel them (`status = "CANCELLED"`, `completedAt = new Date()`).
  - If `target.currentVersionId` exists:
    - Create new `questionAssignment` (`reviewerId = ctx.user.id`, `status = "COMPLETED"`, `completedAt = new Date()`).
    - Insert `reviewComment` with the rejection reason.
  - Update `question` table: `status = "REJECTED"`, `updatedAt = new Date()`.
  - Insert `auditLog`: action `"ADMIN_REJECTED"` with reason in metadata.

- **Add `adminRestoreToDraft`**:
  - Guard: `adminProcedure`.
  - Input: `{ questionId: z.string(), comment: z.string().optional() }`.
  - Validate target question exists and `status === "REJECTED"`.
  - Update `question` table: `status = "DRAFT"`, `updatedAt = new Date()`.
  - If comment provided and `target.currentVersionId` exists, add note to review thread.
  - Insert `auditLog`: action `"ADMIN_RESTORED_TO_DRAFT"`.

- **Update `archiveQuestion`**:
  - Enforce prerequisite check:
    ```ts
    if (target.status !== "APPROVED") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Only APPROVED questions can be archived.",
      });
    }
    ```
  - Update `status = "ARCHIVED"`.

- **Add `unarchiveQuestion`**:
  - Guard: `adminProcedure`.
  - Input: `{ questionId: z.string() }`.
  - Validate target question exists and `status === "ARCHIVED"`.
  - Update `question` table: `status = "APPROVED"`, `updatedAt = new Date()`.
  - Insert `auditLog`: action `"QUESTION_UNARCHIVED"`.

---

### 2. Frontend: Question Studio (`/dashboard/questions`)

#### [MODIFY] [page.tsx](file:///d:/contest-platform/src/app/dashboard/questions/page.tsx)

- Update status filter options to ensure `REJECTED` and `ARCHIVED` are easily filterable.
- Add Admin action buttons in the table row:
  - When `isAdmin` and status is active (`DRAFT`, `CHANGES_REQUESTED`, `SUBMITTED_FOR_REVIEW`, `UNDER_REVIEW`, `APPROVED`): show a subtle "Reject" action with confirmation dialog requiring a rejection reason.
  - When `isAdmin` and status is `REJECTED`: show "Restore to Draft" button.
  - When `isAdmin` and status is `APPROVED`: show "Archive" action alongside existing actions.
  - When `isAdmin` and status is `ARCHIVED`: show "Unarchive to Bank" button.

---

### 3. Frontend: Question Detail Modal

#### [MODIFY] [question-detail-modal.tsx](file:///d:/contest-platform/src/app/dashboard/questions/question-detail-modal.tsx)

- Integrate Admin controls in the modal header and actions footer:
  - **Reject Dialog**: Textarea for mandatory rejection reason + confirmation.
  - **Restore Dialog**: "Restore to Draft" confirmation for rejected questions.
  - **Archive Dialog**: Confirmation to archive approved question.
  - **Unarchive Dialog**: Confirmation to restore archived question directly to `APPROVED`.

---

### 4. Status Badges & Display

#### [MODIFY] [question-status-badge.tsx](file:///d:/contest-platform/src/components/questions/question-status-badge.tsx)

- Verify `REJECTED` (destructive red badge) and `ARCHIVED` (slate / zinc neutral badge) are styled consistently with modern dark/light mode tokens.

---

## Verification Plan

### Automated Tests

- Run `pnpm exec tsc --noEmit` to ensure strict type compliance across all router endpoints and UI components.

### Manual Verification

1. **Admin Reject from Approved**:
   - Select an `APPROVED` question.
   - Trigger Admin Reject with reason "Testing admin rejection".
   - Verify status becomes `REJECTED`.
   - Verify it disappears from `/dashboard/contests/*` question picker (`listQuestionBank`).
   - Verify existing contest referencing this question still loads its version without errors.
2. **Admin Restore to Draft**:
   - Select the `REJECTED` question.
   - Click "Restore to Draft".
   - Verify status becomes `DRAFT`.
   - Verify creator can now edit the draft content in Question Studio.
3. **Archive & Unarchive**:
   - Select an `APPROVED` question.
   - Archive it -> status becomes `ARCHIVED`.
   - Verify non-approved questions cannot be archived (throws error).
   - Unarchive it -> status returns directly to `APPROVED` without needing re-review.

---

# Implementation Plan: Collaborative Question Content Editing (Creator, Reviewer, Admin)

Enable **Creators**, **Reviewers**, and **Admins** to edit question content, problem descriptions, metadata, options, and test cases while a question is actively under review, submitted for review, changes requested, or in draft.

---

## User Review Required

> [!IMPORTANT]
> **Who Can Edit & When**
> - **Creator**: Can edit when status is `DRAFT`, `CHANGES_REQUESTED`, `SUBMITTED_FOR_REVIEW`, or `UNDER_REVIEW`.
> - **Assigned Reviewer**: Can edit while actively reviewing the question (`UNDER_REVIEW` or assigned `PENDING`).
> - **Admin**: Can edit questions at any stage (`DRAFT`, `CHANGES_REQUESTED`, `SUBMITTED_FOR_REVIEW`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`).
>
> **Version & Draft Invariant During Active Review**
> When question content is edited while `UNDER_REVIEW` or `SUBMITTED_FOR_REVIEW`:
> - `question.currentDraft` is updated with the new content.
> - If `target.currentVersionId` points to an unapproved version snapshot (i.e. not yet in any contest), that active snapshot (`questionVersion`) is synchronized with the new content so that:
>   1. The reviewer immediately sees the edits in both the spec panel and code runner.
>   2. When the reviewer or admin clicks **Approve**, the resulting approved version contains the latest edits.
>   3. Contests never see unapproved drafts (since contests only allow `APPROVED` questions).
> - An optional revision note (e.g. *"Reviewer fixed sample test case output format"*) is automatically posted as a `reviewComment` to the discussion thread, notifying all parties.

---

## Open Questions

1. **Automatic Review Thread Note on Edit**:
   When an edit is saved during review, should the system prompt for an optional note (e.g., *"Clarified description and updated option B"*) to be posted to the discussion thread?
   - **Recommendation**: Yes, provide an optional input field *"Revision note for review discussion (optional)"* in the editor save bar. If filled, it automatically posts as a system-annotated comment (`[CONTENT UPDATED]: <note>`).

2. **Editing Approved Questions**:
   Should Admins be allowed to edit content on already `APPROVED` questions?
   - **Recommendation**: Yes, Admins can edit `currentDraft`. If an admin edits an approved question, we update `currentDraft` and the current approved snapshot (if not currently locked in an active live contest session), or prompt them to direct-approve an updated `v(N+1)` snapshot so existing past contests retain their exact original snapshot.

---

## Proposed Changes

### 1. Backend: tRPC Router

#### [MODIFY] [question-bank.ts](file:///d:/contest-platform/src/server/trpc/routers/question-bank.ts)

- **Upgrade `updateDraft`**:
  - Switch procedure from `creatorProcedure` to `creatorOrReviewerProcedure`.
  - Update input schema to accept an optional revision note:
    ```ts
    z.object({
      id: z.string(),
      categoryId: z.string().optional().nullable(),
      topicId: z.string().optional().nullable(),
      difficulty: z.enum(["easy", "medium", "hard"]).optional(),
      draft: questionDraftSchema,
      changeNote: z.string().optional(),
    })
    ```
  - Refactor permission check:
    - Allow if:
      - `target.createdById === ctx.user.id` (Creator)
      - OR `ctx.roles.includes("admin")` (Admin)
      - OR user is an assigned reviewer for this question on an active assignment (`assignment.reviewerId === ctx.user.id` where `assignment.questionId === target.id`).
  - Refactor status check:
    - Allow when `target.status` is `DRAFT`, `CHANGES_REQUESTED`, `SUBMITTED_FOR_REVIEW`, `UNDER_REVIEW`, or `APPROVED` (for admin).
  - Synchronize active version snapshot:
    - If `target.currentVersionId` exists and `target.status !== "APPROVED"`:
      - Update the active `questionVersion` row with the new `title`, `description`, `options`, `correctOptionId`, `hint`, `questionScore`, `starterCode`, `allowedLanguages`, `timeLimit`, `memoryLimit`, `testCases`.
  - Update `question` table:
    - Set `currentDraft = input.draft`, `difficulty`, `categoryId`, `topicId`, `updatedAt = new Date()`.
  - Thread comment & audit log:
    - If `changeNote` is provided:
      - Insert `reviewComment`: `"[QUESTION EDITED by <Role>]: <changeNote>"`.
    - Insert `auditLog`: action `"QUESTION_DRAFT_UPDATED"`.

---

### 2. Frontend: Question Detail Modal (`QuestionDetailModal`)

#### [MODIFY] [question-detail-modal.tsx](file:///d:/contest-platform/src/app/dashboard/questions/question-detail-modal.tsx)

- Add **Edit Mode** state: `const [isEditing, setIsEditing] = useState(false);`
- Add form state pre-populated with current question draft / version:
  - `editTitle`, `editDescription`, `editHint`, `editScore`, `editDifficulty`, `editCategoryId`, `editTopicId`
  - `editOptions`, `editCorrectOptionId` (for MCQ)
  - `editTimeLimit`, `editMemoryLimit`, `editStarterPython`, `editTestCases` (for Code)
  - `changeNote` (optional note for discussion thread)
- Add permission check:
  - `canEdit = isAdmin || q.createdById === session?.user?.id || q.assignments?.some(a => a.reviewerId === session?.user?.id && ["PENDING", "IN_REVIEW"].includes(a.status))`
- Header & Toolbar:
  - Render **"Edit Question"** button (with `PencilEdit02Icon`) when `canEdit && !isEditing`.
  - When `isEditing`:
    - Display **"Save Changes"** (green button, calls `updateDraftMutation`) and **"Cancel"** button.
    - Show optional *"Revision note (posted to discussion thread)"* input.
- Specification Panel:
  - When `isEditing`: render interactive inputs for title, difficulty, score, markdown description with write/preview tabs, MCQ options editor with add/remove/correct-pick, and Code test case editor with add/remove/sample-toggle.
  - When not editing: render rich read-only display with markdown renderer (existing behavior).

---

### 3. Frontend: Reviewer Desk (`src/app/dashboard/reviews/page.tsx`)

#### [MODIFY] [page.tsx](file:///d:/contest-platform/src/app/dashboard/reviews/page.tsx)

- Integrate the same in-place question content editing capability into the Reviewer Desk modal:
  - Add **"Edit Question"** button to the top action bar when assignment is `IN_REVIEW` or user is Admin.
  - Reviewer can adjust test cases, wording, or MCQ options directly while reviewing.
  - Clicking "Save Changes" invokes `updateDraft`, updates the active version, and posts the change note to the chat thread.

---

## Verification Plan

### Automated Tests
- Run `pnpm exec tsc --noEmit` to ensure 0 TypeScript compilation errors.

### Manual Verification
1. **Reviewer In-Review Edit**:
   - Log in as Reviewer.
   - Pick up a question in Reviewer Desk -> status is `IN_REVIEW`.
   - Click "Edit Question" -> modify description and fix a typo in Option B.
   - Add revision note: *"Fixed typo in option B"*.
   - Click "Save Changes".
   - Verify:
     - Changes are immediately saved and displayed.
     - Note appears in `<ReviewDiscussionThread />`.
     - Reviewer clicks "Approve".
     - In Question Bank / Contests, verify the approved question contains the fixed typo.
2. **Creator Reply with Content Edit**:
   - Log in as Reviewer -> Request changes on a question with comment *"Add 1 more edge test case"*.
   - Log in as Creator -> Open Question Detail Modal.
   - Click "Edit Question" -> add new test case, save with note *"Added edge test case for n=0"*.
   - Verify question is updated and note is posted.
   - Creator clicks "Re-submit to Reviewer".
3. **Admin Direct Edit**:
   - Log in as Admin -> Open any question in Question Studio or Reviewer Desk.
   - Verify Admin can edit content at any stage and save successfully.

