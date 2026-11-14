# Handover & Session Status

> **Living document** for session continuity. Read this at the start of every AI session.
> 
> **Rule for Session Summaries**:
> - Append the new 5-line summary for the current session at the top under **Section 1**. Never overwrite or delete old summaries.
> - **Section 2** (What is Fully Done & Stable) and **Section 3** (What is Currently in Progress) must come immediately after Section 1.
> - The previous session's summary moves down to **Section 4** (Previous Session Summaries) after Section 3, archiving older sessions downwards in reverse chronological order.

---

## 1. 5-Line Session Summary (Current Session)

- What was done: Built Student Contest Hub (`/contest`) with past participated contests cards, time-locked scores/ranks, and "Enter Contest Code" Base UI `<Dialog>` modal. Added `getStudentPastContests` TRPC query with PostgreSQL server time-locks. Fixed `getStudentReview` executionResult key mismatch (`details` vs `testCases`) that caused passed sample test cases to show "Wrong Answer". Made Monaco editor and console adaptive between light/dark themes.
- What was committed: Committed and pushed to origin/master.
- Build state: Verified `pnpm exec tsc --noEmit` with 0 type errors.
- What's left: User testing of student contest hub and enter code modal.
- What to watch out for: Live contests are accessible only by entering the code (not listed publicly). For past contests that are still live, scores and ranks remain strictly masked (`NOW() >= contest.endTime`).

---

## 2. What is Fully Done & Stable until last session (replaced every important session)

- **Post-Contest Student Submissions Review & Result Time-Lock**:
  - Authoritative DB Clock: Centralized SQL-level check `isContestEndedDb` using `sql<boolean>NOW() >= ${contest.endTime}` in `getResults`, `getStudentReview`, and `finishAttempt`, preventing server clock skew.
  - Security Leak Plugs:
    - `getByCode`: Removed `correctOption: content.correctOptionId` (prevented MCQ answer key leak) and sanitized `participation.submissions` (masks MCQ score/correctness during live attempts).
    - `submitMcqOrTextAnswer`: Sanitized return value to `{ success: true, id, contestQuestionId, savedAt }` (prevented live MCQ brute forcing).
    - `finishAttempt`: Omits `score` and `rank` from response when `!isEnded`.
    - `getResults`: When `!isEnded`, omits leaderboard and scores, returning only `attemptedCount` and safe projection of contest metadata.
  - Student Results Holding Screen (`src/app/contest/[code]/results/page.tsx`): Displays "Attempt Submitted!", attempted question tally (`X / Y`), and concluded timestamp when contest is live; unlocks score, rank, leaderboard, and review button once contest ends.
  - Fullscreen Review Workspace (`src/app/contest/[code]/review/page.tsx`): Replicates exam layout in read-only review mode with color-coded question palette (🟢 Correct, 🟡 Partial, 🔴 Incorrect, ⚪ Unattempted), problem description, strict final submitted code in Monaco editor, score reconciliation banner, sample test cases, failed hidden test case diagnostics, and masked passed hidden test cases.
- **Admin Code Submissions Live Monitoring & Student Inspection**:
  - Database Schema: Added `contestId` to `submission` table with foreign key `references(() => contest.id, { onDelete: "cascade" })` and composite indexes `submission_contest_id_idx` and `submission_contest_created_at_idx`.
  - Rich Test Case Diagnostics: `submitCode` persists full diagnostic records (input, expected output, stdout, stderr, time, memory, passed, isSample) in `executionResult` for admin inspection, while sanitizing private test cases in student responses.
  - Backend TRPC Queries (`src/server/trpc/routers/contest.ts`):
    - `adminGetSubmissions`: Bi-directional cursor queries (`afterCursor` for live polling prepends, `beforeCursor` for historical paging, filtered to `languageId IS NOT NULL`).
    - `adminGetStudentSubmissions`: Per-student inspection endpoint fetching student info, contest participation, all contest coding questions with best scores, and all chronological code attempts with source code.
    - `adminGetContestParticipants`: Contest participants endpoint with solved problem counts and total code submissions.
  - Frontend Pages & Components:
    - `<StudentSubmissionsDrawer />`: Slide-over drawer with student header, problem pill selector, chronological attempt history, read-only Monaco editor, and expandable failed test case diagnostic diffs.
    - Global Live Submissions Feed (`/dashboard/contests/submissions`): Live monitoring page with contest dropdown filter, status filter, student search, 4s auto-polling, and horizontal scroll table.
    - Contest Detail Tabs (`/dashboard/contests/[id]`): Added "Questions & Settings", "Live Submissions" (with 4s cursor poll), and "Participants" tabs.
    - Dashboard Nav: Added "Live Submissions" header link and quick action card in `/dashboard`.
- **CodeBox Execution Sandbox**: Hosted on AWS EC2 (`http://13.48.249.168`), running Caddy, API, Redis, and Worker with Linux `isolate` sandboxing and auth token verification.
- **Environment Configuration**: Template [`d:\kernel2\.env.example`](file:///d:/kernel2/.env.example) updated with active EC2 CodeBox endpoints and encryption secrets.
- **Contest Access Control**: Contests are restricted exclusively to Admins.
- **AI Question Studio**: Gemini 2.5 and Groq BYOK key management, prompt-to-question generation, and test case drafting.

---

## 3. What is Currently in Progress (this always shows current session progress and is replaced not incrementally updated)

- None. All tasks for Post-Contest Student Submissions Review and Result Time-Lock are completed and verified.

---

## 4. Previous Session Summaries

### Session: 2026-11-14 (Admin Code Submissions Live Monitoring & Inspection)

- What was done: Implemented Admin Code Submissions Live Monitoring and Student Inspection system (denormalized `contest_id` on `submission`, bi-directional cursor live polling, rich test diagnostic logs, Per-Student Monaco Inspection Drawer, Global Live Feed, and Contest Detail Tabs).
- What was committed: Committed and pushed to origin/master.
- Build state: Verified `pnpm exec tsc --noEmit` with 0 type errors.
- What's left: Admin user execution of DB migration / backfill SQL script for existing rows; browser verification.
- What to watch out for: Historical DB submissions require running the provided SQL script to backfill `contest_id` from `contest_participation`. Non-admin users are strictly prevented from querying admin submission endpoints.

### Session: 2026-11-14 (CodeBox AWS EC2 Sandbox Deployment)

- What was done: Deployed CodeBox code execution sandbox on dedicated AWS EC2 instance (`13.48.249.168`) with prebuilt Docker Hub containers, configured environment variables (`CODEBOX_URL`, `CODEBOX_TOKEN`, Neon `DATABASE_URL`), and verified service health.
- What was committed: Committed and pushed to origin/master.
- Build state: CodeBox healthy; Kernel2 environment template updated.
- What's left: End-to-end testing of student code submission from Kernel2 contest runner to EC2 CodeBox.
- What to watch out for: Security group on AWS must keep port 80 open for inbound HTTP submission traffic.

### Session: 2026-10-01 (Creator Question Draft Editing)

- What was done: Implemented Creator Question Draft Editing flow across Question Studio table, Question Detail Modal, and Review Discussion Thread using `trpc.questionBank.updateDraft`.
- What was committed: Committed and pushed to origin/master.
- Build state: Verified `pnpm exec tsc --noEmit` with 0 type errors.
- What's left: User testing of draft editing and resubmission.
- What to watch out for: Only questions in `DRAFT` or `CHANGES_REQUESTED` owned by the creator (or admin) can be edited. Question type is locked during edit to maintain schema integrity.

### Session: 2026-09-18 (Admin Reject, Restore to Draft, Archive/Unarchive)

- What was done: Implemented Admin Universal Question Reject (`adminReject`), Recovery to Draft (`adminRestoreToDraft`), and Archive/Unarchive (`archiveQuestion`, `unarchiveQuestion`) with cancel-and-create assignment audit pattern, mandatory rejection reasons, and confirmation dialogs in Question Studio table and Detail Modal.
- What was committed: Committed and pushed to origin/master.
- Build state: Verified `pnpm exec tsc --noEmit` with 0 type errors.
- What's left: Browser testing of reject, restore to draft, archive, and unarchive flows.
- What to watch out for: `REJECTED` is recoverable to `DRAFT` for creator rework; `ARCHIVED` is restricted to `APPROVED` questions only and restores directly back to `APPROVED` without re-review. Existing contests remain completely unaffected because they reference immutable `questionVersion` snapshots.

### Session: 2026-09-18 (Horizontal Table Scroll Sliders)

- What was done: Added horizontal scroll sliders (`overflow-x-auto` wrapper, `min-w-[1100px]`, `whitespace-nowrap` headers & action cells) to Question Studio and Reviewer Desk tables to prevent action buttons from clipping on narrow viewports.
- What was committed: `48af4ba` (`feat: add horizontal scroll sliders with min-widths to question studio and reviewer desk tables`).
- Build state: Verified `pnpm exec tsc --noEmit` with 0 type errors.
- What's left: Browser testing of horizontal table sliding across multiple screen widths.
- What to watch out for: Tables use an inner `overflow-x-auto` container with `min-w-[1100px]` inside the outer `rounded-2xl border overflow-hidden` wrapper to preserve corner radius.

### Session: 2026-09-18 (Admin Direct Question Approval)

- What was done: Implemented Admin Direct Question Approval with cancel-and-create assignment pattern, shared draft validation (`validateQuestionDraft`), shared client `getUserRoles`, and confirmation dialogs in table and modal.
- What was committed: `b42d601` (`feat: admin direct question approval with immutable snapshot minting and assignment cancel-and-create pattern`), `1436538` (`docs update`).
- Build state: Verified `pnpm exec tsc --noEmit` with 0 type errors.
- What's left: Browser smoke test of direct approval flow and contest picker integration.
- What to watch out for: Direct approval cancels active assignments without deleting them, preserving the audit trail while moving questions straight to `APPROVED`.

### Session: 2026-09-18 (Contest Access Control & Shared Components)

- What was done: Restricted all contest management to Admins, converted Reviewer Desk and Question Studio to tables, extracted shared components (`QuestionStatusBadge`, `ReviewDiscussionThread`), and expanded execution logs.
- What was committed: `1f84975` (tables & review history), `251ef29` (shared components), `50582fc` (contest admin restrictions).
- Build state: Verified `pnpm exec tsc --noEmit` with 0 type errors.
- What's left: Admin direct draft approval workflow.
- What to watch out for: Creators or Reviewers attempting direct URL access to `/dashboard/contests/*` will be redirected to `/dashboard`.
