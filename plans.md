# Implementation Plans Log

> Log of incremental implementation plans with status tags (`[EXECUTED]` or `[CANCELLED]`).

---

# [EXECUTED] Implementation Plan: Student Contest Hub & Earlier Participated Contests View

### Context & Goal
Previously, `/contest` was only a minimal form with a single "Enter Contest Code" input. Students had no way to view their historical contest attempts, check their scores/ranks once contests ended, or launch post-contest Monaco solution reviews directly from a dashboard. Additionally, live contests should not be publicly browsable without an authorized invitation passcode.

This plan implements:
1. **Student Contest Hub (`src/app/contest/page.tsx`)**:
   - Clean, modern student dashboard replacing the bare code-entry page.
   - Header with student credentials, "Contest Hub" badge, theme toggle, and Sign Out.
   - Hero banner with a prominent **"Enter Contest Code"** primary CTA button.
   - Base UI **`<Dialog>` Modal**: Opens on clicking "Enter Contest Code" with an autofocus input for invitation passcodes (e.g. `KRN101`) and navigates to `/contest/[code]`.
   - **Past Contests Grid**: Displays cards for earlier participated contests (`contestParticipation` for the user) with status badges:
     - 🟢 **Concluded**: Shows official Score & Rank with buttons for "Scorecard" (`/results`) and "Review" (`/review`).
     - 🟡 **Results Pending**: Shows holding status badge for submitted contests where the contest is still running (`NOW() < endTime`).
     - 🔵 **In Progress**: Shows "In Progress" badge with a direct "Resume Attempt" CTA (`/attempt`).
     - ⚪ **Timed Out**: Shows unfinished state.
   - **Empty State**: Friendly card encouraging students to enter their first contest invitation code.
2. **Backend TRPC Procedure (`getStudentPastContests` in `src/server/trpc/routers/contest.ts`)**:
   - Queries `contestParticipation` joined with `contest` where `userId = ctx.user.id`.
   - Uses PostgreSQL server clock (`NOW() >= contest.endTime`) to strictly time-lock scores and ranks for active contests.
   - Returns sanitized metadata, status, scores (for concluded), and `canReview` flag.

---

# [EXECUTED] Implementation Plan: Post-Contest Student Submissions Review & Result Visibility System

### Context & Goal
Currently, when a student finishes a contest, they are immediately redirected to `/contest/[code]/results` where their final score, rank, and the leaderboard are displayed, regardless of whether the contest has officially ended. Furthermore, students have no way to review their submitted answers, verify correct solutions, or inspect where their code failed test cases.

This plan implements:
1. **Contest Time Lock for Results**:
   - While the contest is still running (`NOW() < contest.endTime`), students who finish early see **only** the number of attempted questions (e.g., "Attempted 8 of 10 questions"). Scores, ranks, leaderboards, and solutions remain completely hidden to prevent answer leaks to students still competing.
   - Once the contest ends (`NOW() >= contest.endTime`), full scores, ranks, leaderboards, and review access are unlocked and persistently accessible anytime.
2. **Dedicated Fullscreen Review Workspace (`/contest/[code]/review`)**:
   - Replicates the exam workspace layout:
     - **Question Navigator**: Pills for Q1, Q2, Q3... color-coded:
       - 🟢 Green: Correct (Full marks)
       - 🟡 Yellow: Partially correct (e.g. 5/10 test cases passed)
       - 🔴 Red: Incorrect (0 marks)
       - ⚪ Gray: Unattempted / Skipped
     - **Left Panel**: Problem description, difficulty, marks awarded vs max marks, hint.
     - **Right Panel**:
       - **MCQ**: All options displayed, student's chosen option tagged ("Your Answer"), correct option highlighted in green ("Correct Answer"), unattempted state clearly communicated.
       - **Text**: Student's text shown side-by-side with the expected answer.
       - **Coding**:
         - Strict Final submission code displayed in read-only Monaco editor.
         - Score comparison banner: If final attempt score != best score, displays: *"Final Attempt (Score: X/max) — Best Score Counted: Y/max"*.
         - Test case breakdown: Sample test cases shown; hidden test cases are shown **only if the student's submission failed on that hidden test case** (revealing input, expected output, stdout/stderr); passed hidden test cases remain masked.
         - Unattempted state: Displays starter code with *"No code was submitted for this question (0 marks awarded)"*.
3. **Results Page Integration (`/contest/[code]/results`)**:
   - Holding state when `isEnded === false`.
   - Prominent **"Review My Submissions"** button when `isEnded === true`.

---

## Architecture & Implementation Steps

### Step 1: Backend TRPC Router Updates (`src/server/trpc/routers/contest.ts`)

1. **Update `getResults` query**:
   - Calculate `isEnded = new Date() >= new Date(foundContest.endTime)`.
   - Calculate `attemptedCount` = unique `contestQuestionId`s present in `submission` for this participant.
   - If `!isEnded`:
     - Return `{ contest: foundContest, isEnded: false, attemptedCount, totalQuestions: foundContest.totalQuestions, participation: { id: participation.id, finishedAt: participation.finishedAt }, leaderboard: [] }`.
     - Ensures zero score/rank leakage in client DevTools or network payloads.
   - If `isEnded`:
     - Return `{ contest: foundContest, isEnded: true, attemptedCount, totalQuestions: foundContest.totalQuestions, participation, leaderboard }`.

2. **Add `getStudentReview` query (`protectedProcedure`)**:
   - Input: `{ contestId: string }`.
   - Guard checks:
     - Verify contest exists.
     - Verify participant exists and `finishedAt !== null`.
     - Verify contest has ended: `new Date() >= new Date(foundContest.endTime)`. If not ended, throw `FORBIDDEN` ("Solutions and review will be available after the contest ends at [endTime]").
   - Fetch all `contestQuestion`s ordered by `questionOrder`, including `question` and `version`.
   - Fetch all `submission`s for this student in this contest ordered by `createdAt ASC`.
   - For each question:
     - Compute `bestScore = Math.max(...cqSubs.map(s => s.scoreObtained), 0)`.
     - Get `finalSubmission = cqSubs[cqSubs.length - 1] ?? null`.
     - Determine status:
       - No submissions: `"unattempted"`
       - `bestScore === marks`: `"correct"`
       - `bestScore > 0`: `"partial"`
       - `bestScore === 0`: `"incorrect"`
     - Format payload according to question type:
       - **MCQ**: options array, `correctOptionId`, `studentAnswer`, `isCorrect`.
       - **Text**: `expectedAnswer`, `studentAnswer`, `isCorrect`.
       - **Code**: `starterCode`, `allowedLanguages`, `timeLimit`, `memoryLimit`, `finalCode`, `languageId`, `finalScore`, `bestScore`, `executionStatus`.
       - Test Cases:
         - Sample test cases: full details (`input`, `expectedOutput`, `stdout`, `stderr`, `passed`).
         - Hidden test cases: if `passed === false`, reveal details (`input`, `expectedOutput`, `stdout`, `stderr`, `passed: false`); if `passed === true`, return only `{ isSample: false, passed: true }`.

---

### Step 2: Results Page Update (`src/app/contest/[code]/results/page.tsx`)

1. Support holding state when `results.isEnded === false`:
   - Replace score and rank cards with:
     - "Contest Completed — Results Pending"
     - "Questions Attempted: {attemptedCount} / {totalQuestions}"
     - Banner: "Contest is still in progress. Official scores, rankings, and solution reviews will be published once the contest concludes at {formattedEndTime}."
     - Hide leaderboard.
2. When `results.isEnded === true`:
   - Keep congratulations card with Score, Rank, and Finish time.
   - Add **"Review My Submissions"** button with icon linking to `/contest/[code]/review`.
   - Render leaderboard.

---

### Step 3: Fullscreen Review Workspace (`src/app/contest/[code]/review/page.tsx`)

1. Build responsive fullscreen layout modeled after `/contest/[code]/attempt/page.tsx`:
   - **Header**:
     - "Back to Results" button (`/contest/[code]/results`).
     - Contest title with "Review Mode" badge.
     - Final score summary badge: `Score: {score} / {totalScore}`.
     - Dark/Light mode toggle.
   - **Top Question Navigator**:
     - Pill buttons for Q1..Qn.
     - Badges with icons:
       - 🟢 Green: Correct
       - 🟡 Yellow: Partial
       - 🔴 Red: Incorrect
       - ⚪ Gray: Unattempted
   - **Two-Column Resizable Body**:
     - **Left Column**:
       - Question order, type, and difficulty badges.
       - Marks awarded badge: `Awarded: {awardedMarks} / {marks} pts`.
       - Markdown description of problem.
       - Expandable Hint (if present).
     - **Right Column**:
       - **MCQ Review**:
         - List of options.
         - Selected option tagged with "Your Answer".
         - Correct option highlighted in green with "Correct Answer" badge.
         - Unattempted banner if skipped.
       - **Text Review**:
         - Student's submitted text vs Expected answer.
       - **Coding Review**:
         - Discrepancy Banner: If `finalScore !== bestScore`, displays: *"Final Attempt Score: {finalScore}/{marks} — Best Score Counted: {bestScore}/{marks}"*.
         - Language and execution time/memory metadata.
         - Read-only Monaco code viewer.
         - Test cases diagnostic accordion:
           - Sample test cases.
           - Failed hidden test cases with input, expected, and stdout/stderr.
           - Passed hidden test cases with "Passed (Private Test Case)" badge.
         - If unattempted: displays starter code with notice *"No code was submitted for this question"*.
   - **Footer Navigation**:
     - "Previous Question" and "Next Question" buttons.

---

### Step 4: Verification & Test Checklist
- Run `pnpm exec tsc --noEmit` and confirm 0 type errors.
- Test active contest holding state (`isEnded === false`) -> confirm scores/ranks/leaderboard/solutions are hidden.
- Test completed contest state (`isEnded === true`) -> confirm scores, rank, and "Review My Submissions" button.
- Test MCQ, Text, and Code reviews across Correct, Partial, Incorrect, and Unattempted states.
- Verify hidden test case masking: failed hidden cases show diagnostics; passed hidden cases stay masked.
- Verify Best Score vs Final Attempt note when final attempt scored less than best attempt.

---

# [EXECUTED] Implementation Plan: Admin Code Submissions Live Monitoring & Student Inspection System

### Context & Need
Admins currently have no visibility into student code submissions during or after contests. There is no page to see what students are submitting, whether code is passing or failing, or to inspect individual student attempts. The existing admin contest pages only handle CRUD for contest settings and questions.

This plan adds:
1. A **global live submissions feed** at `/dashboard/contests/submissions` showing real-time coding submissions across all contests, with contest/status/student filters.
2. A **per-contest submissions tab** inside the existing `/dashboard/contests/[id]` page.
3. A **per-student inspection drawer** showing all coding attempts for a student in a contest, with Monaco code viewer and full test case diagnostic logs for failed cases.

### Design Decisions (from review)
- **Scoring**: Best score (`Math.max`) — no penalty. Already implemented in `finishAttempt`. No changes.
- **Live feed scope**: Code submissions only (not MCQ/text). Filter by `languageId IS NOT NULL`.
- **Diagnostic storage**: Full test case data (input, expected, stdout, stderr) stored in DB for admin inspection. Student response continues to be redacted for private test cases.
- **Direct `contestId` column on `submission`**: Denormalize `contestId` onto the `submission` table with an index on `(contestId, createdAt DESC)`. Eliminates repeated cross-table joins and powers fast filtering.
- **Bi-directional Cursor Live Polling**:
  - **Live streaming**: Polls `WHERE createdAt > :afterCursor` (only fetching submissions created after the newest seen timestamp) and prepends them seamlessly to the top of the feed. Guaranteed zero missed submissions and zero layout jumps.
  - **Historical scrolling**: Fetches `WHERE createdAt < :beforeCursor` when user clicks "Load More" to append older entries.
- **Drawer design**: Per-student (not per-problem). Shows all coding questions and all attempts for the selected student in the contest.

### Constraints & Migration Check
- Schema addition: Add `contestId` to `submission` table in `src/server/db/contest-schema.ts` and backfill existing DB records using `contest_participation.contest_id`.
- SQL Migration provided below to cleanly backfill both the live database and legacy CSV imports (`submission.csv`).
- ✅ All new endpoints use `adminProcedure` — respects Contest Access Restriction constraint.
- ✅ Student contest runner mechanics (`/contest/[code]`) are not modified — only writes `contestId` on submit and enriches diagnostic log storage.
- ✅ Full type check verified.

---

## Step 0: Database Migration — Add & Backfill `contest_id` on `submission`

### 1. Drizzle Schema Update: `src/server/db/contest-schema.ts`
```ts
export const submission = pgTable("submission", {
  id: text("id").primaryKey(),
  contestId: text("contest_id")
    .notNull()
    .references(() => contest.id, { onDelete: "cascade" }),
  contestParticipationId: text("contest_participation_id")
    .notNull()
    .references(() => contestParticipation.id, { onDelete: "cascade" }),
  contestQuestionId: text("contest_question_id")
    .notNull()
    .references(() => contestQuestion.id, { onDelete: "cascade" }),
  questionId: text("question_id")
    .notNull()
    .references(() => question.id),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  userAnswer: text("user_answer").notNull(),
  languageId: integer("language_id"),
  status: text("status").notNull(),
  scoreObtained: integer("score_obtained").default(0).notNull(),
  executionResult: jsonb("execution_result"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("submission_contest_id_idx").on(table.contestId),
  index("submission_contest_created_at_idx").on(table.contestId, table.createdAt),
  index("submission_participation_idx").on(table.contestParticipationId),
  index("submission_contest_question_idx").on(table.contestQuestionId),
  index("submission_question_idx").on(table.questionId),
  index("submission_user_idx").on(table.userId),
]);
```

### 2. SQL Migration Query for Live Database (or for importing `submission.csv`)

```sql
-- ============================================================================
-- Step A: Add contest_id column as nullable
-- ============================================================================
ALTER TABLE "submission" 
ADD COLUMN IF NOT EXISTS "contest_id" text REFERENCES "contest"("id") ON DELETE CASCADE;

-- ============================================================================
-- Step B: Backfill contest_id from contest_participation
-- ============================================================================
UPDATE "submission" s
SET "contest_id" = cp."contest_id"
FROM "contest_participation" cp
WHERE s."contest_participation_id" = cp."id"
  AND s."contest_id" IS NULL;

-- ============================================================================
-- Step C: Fallback backfill from contest_question (for any edge-case orphaned links)
-- ============================================================================
UPDATE "submission" s
SET "contest_id" = cq."contest_id"
FROM "contest_question" cq
WHERE s."contest_question_id" = cq."id"
  AND s."contest_id" IS NULL;

-- ============================================================================
-- Step D: Enforce NOT NULL and create high-speed indexes for live polling
-- ============================================================================
ALTER TABLE "submission" ALTER COLUMN "contest_id" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "submission_contest_id_idx" 
ON "submission" ("contest_id");

CREATE INDEX IF NOT EXISTS "submission_contest_created_at_idx" 
ON "submission" ("contest_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "submission_code_created_at_idx" 
ON "submission" ("created_at" DESC) 
WHERE "language_id" IS NOT NULL;
```

---

## Step 1: Backend — Enrich `submitCode` & Insert `contestId`

### [MODIFY] `src/server/trpc/routers/contest.ts` — `submitCode` and `submitMcqOrTextAnswer`

- When inserting into `submission`, include `contestId: input.contestId`.
- Store the **full** diagnostic data in the `executionResult` JSONB column (input, expectedOutput, stdout, stderr, compile_output, time, memory, status, passed, isSample) for every test case.
- **Redact the response** returned to the student: map over `executionResult.details` before the `return` statement to strip `input`, `expectedOutput`, `stdout`, and `stderr` for non-sample test cases.

---

## Step 2: Backend — Cursor-Based Admin Query Endpoints

### [MODIFY] `src/server/trpc/routers/contest.ts` — Add 3 new `adminProcedure` endpoints

#### 2a. `adminGetSubmissions` — Cursor-Based Live Feed

```ts
adminGetSubmissions: adminProcedure
  .input(z.object({
    contestId: z.string().optional(),
    userId: z.string().optional(),
    status: z.string().optional(),       // "Accepted", "Wrong Answer", etc.
    afterCursor: z.coerce.date().optional(),  // LIVE POLL: fetches new rows created AFTER this timestamp
    beforeCursor: z.coerce.date().optional(), // LOAD MORE: fetches older rows created BEFORE this timestamp
    limit: z.number().min(1).max(100).default(50),
  }))
  .query(async ({ ctx, input }) => {
    // Queries submission directly on contestId without multi-table join
    // Filters submission.languageId IS NOT NULL (coding submissions only)
    // If afterCursor is provided: returns new arrivals ordered ASC or DESC to prepend
    // If beforeCursor is provided: returns historical page ordered DESC
  })
```

**Query Advantages with `contestId` + Cursor**:
- Direct query on `submission` using index `submission_contest_created_at_idx` or `submission_code_created_at_idx`.
- Live polling query is ultra-lean: `WHERE contest_id = ? AND language_id IS NOT NULL AND created_at > :afterCursor ORDER BY created_at DESC`. Returns only new submissions (often empty array or 1-2 items) costing virtually zero database IO!
- No missed submissions if multiple students submit within the same second.

#### 2b. `adminGetStudentSubmissions` — Full student inspection data
#### 2c. `adminGetContestParticipants` — Participants list for a contest
```

**Implementation approach**: Use Drizzle's explicit `db.select().from(submission).innerJoin(...)` API (NOT the relational `db.query` API) because:
- The `submission` table has no direct `contestId` column. Must join through `contestParticipation` to reach `contest`.
- Need to join `user` for student name/email.
- Need to join `contestQuestion → question` for question title and type.
- Must filter `submission.languageId IS NOT NULL` to exclude MCQ/text submissions.

**Joins**:
```
submission
  INNER JOIN user ON submission.userId = user.id
  INNER JOIN contestParticipation ON submission.contestParticipationId = contestParticipation.id
  INNER JOIN contest ON contestParticipation.contestId = contest.id
  INNER JOIN contestQuestion ON submission.contestQuestionId = contestQuestion.id
  INNER JOIN question ON submission.questionId = question.id
```

**WHERE clauses** (conditional):
- Always: `submission.languageId IS NOT NULL` (code-only)
- If `contestId`: `contestParticipation.contestId = input.contestId`
- If `userId`: `submission.userId = input.userId`
- If `status`: `submission.status = input.status`

**ORDER BY**: `submission.createdAt DESC`
**LIMIT/OFFSET**: `input.limit`, `input.offset`

**Returns**: Array of objects:
```ts
{
  id: string,
  createdAt: Date,
  status: string,
  scoreObtained: number,
  languageId: number,
  // Student info
  student: { id, name, email },
  // Contest info
  contest: { id, title, code },
  // Question info
  question: { id, title, questionType },
  // Contest question info
  contestQuestion: { marks, questionOrder },
}
```

Note: Does NOT return `userAnswer` (source code) or `executionResult` (diagnostic logs) — those are fetched only when the admin opens the student drawer, to keep the feed response lightweight.

#### 2b. `adminGetStudentSubmissions` — Full student inspection data

```ts
adminGetStudentSubmissions: adminProcedure
  .input(z.object({
    contestId: z.string(),
    userId: z.string(),
  }))
  .query(...)
```

**Returns**:
```ts
{
  // Student metadata
  student: { id, name, email },
  // Participation record
  participation: { id, joinedAt, startedAt, finishedAt, score, rank },
  // Contest metadata
  contest: { id, title, code, totalScore },
  // All coding questions in this contest (filtered to questionType = 'code')
  codingQuestions: [{
    contestQuestionId: string,
    questionOrder: number,
    marks: number,
    title: string,
    bestScore: number,       // Math.max of all attempts for this question
    attemptCount: number,    // total submission count
  }],
  // All code submissions for this student in this contest, ordered by createdAt ASC
  submissions: [{
    id, createdAt, status, scoreObtained, languageId,
    contestQuestionId,       // to group by question in the drawer
    userAnswer: string,      // full source code (for Monaco viewer)
    executionResult: object, // full diagnostic JSON (for test case inspection)
  }],
}
```

**Implementation approach**: Use Drizzle relational queries (`db.query.contestParticipation.findFirst({ with: { ... } })`). This endpoint fetches a single student's data, so nested `with` is clean here.

**Filtering coding questions**: Join `contestQuestion → question` and filter `question.questionType = 'code'`.

#### 2c. `adminGetContestParticipants` — Participants list for a contest

```ts
adminGetContestParticipants: adminProcedure
  .input(z.object({ contestId: z.string() }))
  .query(...)
```

**Returns**: Array of:
```ts
{
  userId: string,
  name: string,
  email: string,
  joinedAt: Date,
  startedAt: Date | null,
  finishedAt: Date | null,
  score: number,
  rank: number | null,
  codeSubmissionCount: number,  // count of code submissions (languageId IS NOT NULL)
}
```

This powers the "Participants" tab in the contest detail page, where clicking a student opens the drawer.

---

## Step 3: Frontend — Global Live Submissions Feed Page

### [CREATE] `src/app/dashboard/contests/submissions/page.tsx`

**Route**: `/dashboard/contests/submissions`
**Admin guard**: Inherits from existing `ContestsAdminLayout` at `/dashboard/contests/layout.tsx` — no additional guard needed.

**Layout**:
- **Header bar**: Title "Live Code Submissions", Back button to `/dashboard`.
- **Controls row**:
  - **Live toggle**: Switch that enables `refetchInterval: 4000` on the TanStack Query. When off, manual refresh button. Visual indicator (pulsing green dot) when live.
  - **Contest filter**: `<Select>` dropdown populated from `trpc.contest.listAll`. "All Contests" default.
  - **Status filter**: `<Select>` with options: All, Accepted, Wrong Answer, Time Limit Exceeded, Runtime Error, Compilation Error.
  - **Student search**: Text input that debounces and searches by name/email (frontend filtering on the fetched batch, or a server-side `userId` filter if a student is selected from a suggestion dropdown).
- **Table**: Horizontal-scrollable table with columns:
  | Column | Content |
  |--------|---------|
  | Time | Relative timestamp (`2s ago`, `1m ago`) using `date-fns formatDistanceToNow` |
  | Student | Name + email (truncated) |
  | Contest | Contest title (hidden if contest filter is active) |
  | Problem | `#order: title` (e.g. `#2: Container With Most Water`) |
  | Language | Language name badge (Python, Node, C++, Java, C) mapped from `languageId` |
  | Status | Color-coded badge: Green=Accepted, Red=Wrong Answer, Orange=TLE, Yellow=CE, Gray=RE |
  | Score | `scoreObtained / marks` |
  | Action | "Inspect" button → opens `<StudentSubmissionsDrawer />` |

- **Pagination**: "Load More" button at the bottom. Increments `offset` by `limit`.
- **Empty state**: "No code submissions yet" with appropriate icon.

**Data source**: `trpc.contest.adminGetSubmissions` with reactive filters.

---

## Step 4: Frontend — Contest Detail Page Tabs

### [MODIFY] `src/app/dashboard/contests/[id]/page.tsx`

**Current state**: Single-view page with contest summary box, metadata grid, and questions list.

**Change**: Add a tab bar below the contest summary box with 3 tabs:

1. **Questions & Settings** (default) — Current content (questions list, edit/add buttons).
2. **Submissions Feed** — Embeds the same submissions table component from Step 3, pre-filtered to `contestId`. Live toggle enabled by default.
3. **Participants** — Table of all students who joined, powered by `adminGetContestParticipants`:
   | Column | Content |
   |--------|---------|
   | Student | Name + email |
   | Joined | Timestamp |
   | Started | Timestamp or "Not started" |
   | Status | "In Progress" / "Finished" / "Not started" badge |
   | Code Submissions | Count |
   | Score | Final score (or "—" if not finished) |
   | Rank | Rank number (or "—") |
   | Action | "View Submissions" → opens `<StudentSubmissionsDrawer />` |

**Tab implementation**: Use a simple `useState<"questions" | "submissions" | "participants">` with conditional rendering. No URL-based tabs needed (keeps it simple).

---

## Step 5: Frontend — Student Submissions Drawer

### [CREATE] `src/components/contests/student-submissions-drawer.tsx`

**Trigger**: Opened from either the global submissions feed or the contest participants table. Receives `contestId` and `userId` as props.

**Component**: Uses shadcn `<Sheet>` (side drawer) opening from the right, sized `sm:max-w-2xl`.

**Data source**: `trpc.contest.adminGetStudentSubmissions({ contestId, userId })`

**Layout**:

```
┌─────────────────────────────────────────────┐
│ Student: John Doe (john@example.com)        │
│ Status: In Progress | Score: 140/200        │
├─────────────────────────────────────────────┤
│ [#1: Two Sum ✅ 100/100] [#3: MaxWater 🔴 40/100] │  ← Problem pills (code only)
├─────────────────────────────────────────────┤
│ Attempts for #3: Container With Most Water  │
│                                             │
│ ┌─ Attempt #3 — 9:14 PM ───────────────┐   │
│ │ Status: Wrong Answer (3/5 passed)     │   │
│ │ Language: Python 3.8 | Time: 0.04s    │   │
│ │ [▼ View Code] [▼ Test Results]        │   │
│ └───────────────────────────────────────┘   │
│ ┌─ Attempt #2 — 9:11 PM ───────────────┐   │
│ │ Status: Compilation Error             │   │
│ │ ...                                   │   │
│ └───────────────────────────────────────┘   │
│ ┌─ Attempt #1 — 9:08 PM ───────────────┐   │
│ │ Status: Accepted (5/5 passed)         │   │
│ │ ...                                   │   │
│ └───────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

**Sections**:

1. **Header**: Student name, email, participation status (In Progress / Finished), total best score across all coding questions.

2. **Problem Pill Selector**: Horizontal row of pill buttons, one per coding question (filtered to `questionType = 'code'`). Each pill shows:
   - `#order: title (truncated)`
   - Best score badge (green if full marks, red/orange otherwise)
   - Attempt count
   - Active pill is highlighted.

3. **Attempts List** (for selected problem): Reverse-chronological list of all submissions for that `contestQuestionId`. Each attempt is a collapsible card:
   - **Header row**: Attempt number, timestamp (formatted), status badge, language badge, execution time, memory.
   - **Expandable "View Code"**: Monaco Editor (`@monaco-editor/react`) in read-only mode, dark theme, language set from `languageId`. Shows `submission.userAnswer`.
   - **Expandable "Test Results"**: Iterates over `executionResult.details`:
     - **Passed test cases**: Green row with `✓ Test Case #N: Passed (0.02s, 14MB)`. No expandable detail.
     - **Failed test cases**: Red row, expandable to show:
       - **Input** (`stdin`): Monospace pre block.
       - **Expected Output**: Monospace pre block.
       - **Student Output** (`stdout`): Monospace pre block, highlighted if different from expected.
       - **Stderr / Compile Output**: If present, shown in red monospace block.

---

## Step 6: Frontend — Dashboard Navigation Link

### [MODIFY] `src/app/dashboard/page.tsx`

**Change**: Add a navigation link in the admin section of the dashboard nav bar and a quick-access card.

- In the top nav bar (inside the `{isAdmin && ...}` block, after "Users & Roles"):
  ```tsx
  <Link href="/dashboard/contests/submissions" className="...">
    Code Submissions
  </Link>
  ```

- In the admin quick actions section, add a card/button:
  ```
  "View Live Submissions" → navigates to /dashboard/contests/submissions
  ```

---

## Step 7: Shared Utilities

### [CREATE] `src/lib/language-map.ts`

Small utility to map `languageId` numbers to display names, used by both the global feed and the drawer:

```ts
export const LANGUAGE_MAP: Record<number, { name: string; monacoKey: string }> = {
  71: { name: "Python 3.8", monacoKey: "python" },
  63: { name: "Node.js 18", monacoKey: "javascript" },
  54: { name: "C++ (GCC 9)", monacoKey: "cpp" },
  50: { name: "C (GCC 9)", monacoKey: "c" },
  62: { name: "Java 17", monacoKey: "java" },
};
```

This deduplicates the language ID → name mapping that currently lives only in `src/server/codebox.ts` (server-side) and `src/app/contest/[code]/attempt/page.tsx` (client-side).

---

## Files Summary

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `src/server/trpc/routers/contest.ts` | Enrich `submitCode` diagnostic data + add 3 admin endpoints |
| CREATE | `src/app/dashboard/contests/submissions/page.tsx` | Global live submissions feed page |
| MODIFY | `src/app/dashboard/contests/[id]/page.tsx` | Add Submissions Feed + Participants tabs |
| CREATE | `src/components/contests/student-submissions-drawer.tsx` | Per-student inspection side drawer |
| MODIFY | `src/app/dashboard/page.tsx` | Add "Code Submissions" nav link for admins |
| CREATE | `src/lib/language-map.ts` | Shared language ID → name/monaco mapping |

**No new dependencies.** No schema migration. No changes to student-facing contest runner.

---

## Verification Checklist

1. `pnpm exec tsc --noEmit` — 0 type errors.
2. Submit code as a student (Python, JS, C++, Java) → verify student still sees redacted test case output (no hidden inputs/expected outputs in browser DevTools network tab).
3. Open `/dashboard/contests/submissions` as admin → verify submissions appear, live toggle works, filters work.
4. Open a contest detail page → verify new tabs render, submissions tab is pre-filtered.
5. Click "Inspect" on a submission → verify drawer opens with correct student, problems load, attempts display, Monaco renders code, failed test cases show full diagnostic diff.
6. Verify non-admin users cannot access `/dashboard/contests/submissions` (redirected by `ContestsAdminLayout`).

---

# [EXECUTED] Implementation Plan: Creator Draft Editing Flow in Question Studio & Detail Modal

### Context & Need
Creators drafting or revising questions (in `DRAFT` or `CHANGES_REQUESTED` status) need an intuitive way in the web interface to edit problem statements, hints, scores, options, test cases, and taxonomy tags. While the backend mutation `questionBank.updateDraft` was implemented, the Question Studio table, detail modal, and review discussion thread lacked an "Edit Draft" action and form prefilling mechanism.

### Key Changes
1. **Creator Question Studio Table ([src/app/dashboard/questions/page.tsx](file:///d:/contest-platform/src/app/dashboard/questions/page.tsx))**:
   - Add `updateDraftMutation` hooked to `trpc.questionBank.updateDraft`.
   - Add `editingQuestionId` state and `handleOpenEdit(question)` to populate all form fields (title, description, score, hint, options, test cases, taxonomy).
   - Add "Edit Draft" button to table action column for questions in `DRAFT` or `CHANGES_REQUESTED` owned by the user (or admin).
   - Update editor dialog to dynamic mode (Create vs. Edit) with type guard and dynamic submit action.
2. **Question Detail Modal ([src/app/dashboard/questions/question-detail-modal.tsx](file:///d:/contest-platform/src/app/dashboard/questions/question-detail-modal.tsx))**:
   - Add `onEditDraft` prop and header "Edit Draft" button for editable questions.
3. **Review Discussion Thread ([src/components/questions/review-discussion-thread.tsx](file:///d:/contest-platform/src/components/questions/review-discussion-thread.tsx))**:
   - Add `onEditDraft` action in `CHANGES_REQUESTED` feedback banner next to re-submit button.

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

