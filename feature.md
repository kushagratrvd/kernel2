# Feature Trace: Admin Code Submissions Live Monitoring & Student Inspection

> Full lifecycle trace file for this feature: scoping, architecture decisions, implementation progress, test verification, and resolution.

---

## 1. Feature Scoping & Context
- **Problem Statement**: Admins lacked visibility into student code submissions made during and after contests. There was no interface to view submissions across contests, view live code streams, inspect test case execution results, or see a student's chronological code attempts.
- **Goals**:
  1. Add `contest_id` to `submission` table with indexing to eliminate multi-table joins.
  2. Build a Global Live Submissions feed (`/dashboard/contests/submissions`) with bi-directional cursor polling (`afterCursor` for live prepends, `beforeCursor` for history).
  3. Enrich `submitCode` mutation to persist full test case diagnostics in `executionResult` (input, expected, student stdout, stderr) for admin inspection while maintaining redacted output for students.
  4. Create a Per-Student Inspection Drawer (`<StudentSubmissionsDrawer />`) with coding problem selectors, chronological attempt history, Monaco code viewer, and detailed test case failure diffs.
  5. Add tabs to Contest Detail (`/dashboard/contests/[id]`): Questions, Submissions Feed, Participants.
  6. Add top-level navigation in Admin Dashboard to Code Submissions.

---

## 2. Implementation Steps
- [x] Step 1: Update Drizzle Schema (`src/server/db/contest-schema.ts`) with `contestId` and relation.
- [x] Step 2: Shared utility (`src/lib/language-map.ts`) for mapping language IDs.
- [x] Step 3: Backend router updates (`src/server/trpc/routers/contest.ts`):
  - `submitCode` & `submitMcqOrTextAnswer` write `contestId`.
  - `submitCode` stores full diagnostics in `executionResult`, redacts in student response.
  - `adminGetSubmissions` with bi-directional cursor & filters.
  - `adminGetStudentSubmissions` for student drawer.
  - `adminGetContestParticipants` for contest participants tab.
- [x] Step 4: Component `<StudentSubmissionsDrawer />` (`src/components/contests/student-submissions-drawer.tsx`).
- [x] Step 5: Global Live Submissions Page (`src/app/dashboard/contests/submissions/page.tsx`).
- [x] Step 6: Contest Detail Tabs (`src/app/dashboard/contests/[id]/page.tsx`).
- [x] Step 7: Dashboard Nav Link (`src/app/dashboard/page.tsx`).
- [x] Step 8: Verification with `pnpm exec tsc --noEmit`.

---

## 3. Log of Changes & Verification
- **Schema & Migrations**:
  - Added `contestId` to `submission` table in `src/server/db/contest-schema.ts` referencing `contest.id` with `onDelete: "cascade"`.
  - Added indexes: `submission_contest_id_idx` and composite index `submission_contest_created_at_idx` (`contest_id, created_at`).
  - Added `contestRelations.submissions` and `submissionRelations.contest`.
- **Shared Helpers**:
  - Created `src/lib/language-map.ts` covering Python (71), JavaScript (63), C++ (54), C (50), Java (62) with display names, extensions, and Monaco language keys.
- **Backend Endpoints (`src/server/trpc/routers/contest.ts`)**:
  - `submitMcqOrTextAnswer`: Writes `contestId: input.contestId`.
  - `submitCode`: Writes `contestId: input.contestId`. Persists enriched `executionResult` (input, expectedOutput, stdout, stderr, compile_output, time, memory, passed, isSample) in DB, while sanitizing private test cases in client return.
  - `adminGetSubmissions`: Admin-only query with bi-directional cursor (`afterCursor` for prepending new live submissions, `beforeCursor` for loading historical older submissions), filtering by `contestId`, `status`, and `searchQuery`, locked to coding questions (`languageId IS NOT NULL`).
  - `adminGetStudentSubmissions`: Admin-only per-student endpoint returning participant metadata, contest coding questions with best scores, and all chronological code attempts with full source code and diagnostics.
  - `adminGetContestParticipants`: Admin-only endpoint returning participant list, rank, total score, total problems, solved coding count, and total submissions.
- **Frontend Components & Pages**:
  - `src/components/contests/student-submissions-drawer.tsx`: Slide-over drawer with student header, problem pill selector, attempt card list, read-only Monaco editor, and expandable failed test case diagnostic cards with stdin/stdout/expected diffs.
  - `src/app/dashboard/contests/submissions/page.tsx`: Global live submissions dashboard with contest selector, status filter, student search, 4s auto-polling, "View Student Attempts" drawer trigger, and horizontal scroll table.
  - `src/app/dashboard/contests/[id]/page.tsx`: 3-tab layout: "Questions & Settings", "Live Submissions" (with 4s cursor poll), and "Participants" (with student drawer trigger).
  - `src/app/dashboard/page.tsx`: Added "Live Submissions" in header and quick action button in Admin section.
- **Verification**:
  - `pnpm exec tsc --noEmit` executed: 0 errors, build state clean.
  - All procedures protected by `adminProcedure` verifying role boundaries.

---

# Feature Trace: Post-Contest Student Submissions Review & Result Visibility System

## 1. Feature Scoping & Context
- **Problem Statement**:
  1. When students finish an active contest, their score, rank, and leaderboard are displayed immediately while other students are still competing, creating cheating and answer leak risks.
  2. Students cannot review their answers after the contest: they cannot see what they submitted, what the correct answers were, or inspect why their code failed hidden test cases.
- **Goals**:
  1. Time-lock scores, ranks, and leaderboard behind contest conclusion (`NOW() >= contest.endTime`). During active contest, show only "Questions Attempted: X / Y".
  2. Build a dedicated fullscreen Review Workspace (`/contest/[code]/review`) replicating the attempt exam workspace.
  3. Color-code question navigator pills (🟢 Correct, 🟡 Partial, 🔴 Incorrect, ⚪ Unattempted).
  4. Display student's strict final submitted code in read-only Monaco editor, with explicit score reconciliation if their counted best score was higher.
  5. Selectively reveal failed hidden test case diagnostics (input, expected, stdout) so students can debug failures, while keeping passed hidden test cases concealed to protect question bank longevity.
  6. Support unattempted question states for MCQ, Text, and Code.

## 2. Implementation Steps
- [x] Step 1: Update `trpc.contest.getResults` to enforce DB time-lock (`NOW() >= contest.endTime`) and return `attemptedCount` + `isEnded`.
- [x] Step 2: Add `trpc.contest.getStudentReview` endpoint with authoritative DB time-lock guard, strict final submission, and selective hidden test case failure diagnostics.
- [x] Step 3: Security audit and leak mitigation:
  - Plugged MCQ answer key leak in `getByCode` (removed `correctOption: content.correctOptionId`).
  - Plugged MCQ brute-force vulnerability in `submitMcqOrTextAnswer` (sanitized return payload).
  - Sanitized `finishAttempt` (omits score and rank when `isEnded === false`).
  - Sanitized `getByCode`'s `participation.submissions` (masks MCQ score/correctness during live attempts).
- [x] Step 4: Update Results Page (`src/app/contest/[code]/results/page.tsx`) with holding screen when `isEnded === false` and "Review My Submissions" button when `isEnded === true`.
- [x] Step 5: Create Fullscreen Review Workspace (`src/app/contest/[code]/review/page.tsx`) with question navigator, Monaco code viewer, score reconciliation callout, and test case cards.
- [x] Step 6: Verification with `pnpm exec tsc --noEmit`.

---

## 3. Log of Changes & Verification
- **Authoritative Database Clock (`isContestEndedDb`)**:
  - Implemented SQL-level time comparison `SELECT (NOW() >= end_time) AS is_ended FROM contest WHERE id = ...` using Drizzle ORM `sql<boolean>`NOW() >= ${contest.endTime}``.
  - Evaluated in `getResults`, `getStudentReview`, and `finishAttempt` to prevent application-server clock drift.
- **Audit & Security Hardening**:
  - `getByCode`: Removed `correctOption: content.correctOptionId` and sanitized `participation.submissions` so MCQ scores/statuses are masked as `"Submitted"`.
  - `submitMcqOrTextAnswer`: Sanitized return payload to `{ success: true, id, contestQuestionId, savedAt }` preventing live brute-forcing of MCQ options.
  - `finishAttempt`: Time-locked response; omits `score` and `rank` when `!isEnded`.
  - `getResults`: When `!isEnded`, omits leaderboard and scores, returning only `attemptedCount` and safe projection of contest metadata.
- **Frontend Results Page (`src/app/contest/[code]/results/page.tsx`)**:
  - Implemented holding screen for active contests displaying "Attempt Submitted!", attempted question tally, and end time.
  - Implemented post-contest screen displaying official score, rank, leaderboard, and "Review My Submissions" button.
- **Dedicated Review Workspace (`src/app/contest/[code]/review/page.tsx`)**:
  - Fullscreen exam review layout with color-coded question pills (🟢 Correct, 🟡 Partial, 🔴 Incorrect, ⚪ Unattempted).
  - Resizable panels: problem statement (Markdown), difficulty, marks awarded vs max marks, and hint.
  - Answer review:
    - MCQ: Shows student answer tag and green correct answer key tag.
    - Text: Student answer vs expected answer.
    - Code: Read-only Monaco editor showing strict final submitted code, language tag, reconciliation banner if best score > final score, sample test cases, failed private test case diagnostics, and masked passed private test cases.
- **Verification**:
  - `pnpm exec tsc --noEmit` executed: **0 errors** (Clean build).
