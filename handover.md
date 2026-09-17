# Handover & Session Status

> **Living document** for session continuity. Read this at the start of every AI session.

---

## 1. What is Fully Done & Stable

- **Contest Access Control**: Contests are restricted exclusively to Admins.
  - Backend: `listAll`, `create`, `getForEdit`, `addQuestion`, `removeQuestion`, `deleteQuestion`, `updateQuestion`, and `update` all require `adminProcedure`.
  - Frontend: `ContestsAdminLayout` guards `/dashboard/contests/*`, redirecting non-admins to `/dashboard`.
  - Dashboard UI: Contests query, "Active Contests" card, "Create Contest" button, and "Contests Overview" table are hidden from Creators and Reviewers.
- **Shared Components**:
  - `<QuestionStatusBadge />` & `<ReviewAssignmentStatusBadge />` in `src/components/questions/question-status-badge.tsx`.
  - `<ReviewDiscussionThread />` in `src/components/questions/review-discussion-thread.tsx` (handles feedback banners, message stream, role badges, interactive replies).
- **Dashboard Table Views**:
  - Reviewer Desk (`/dashboard/reviews`): Table layout with real-time assignment status, accurate "Changes Requested" badges, and full thread inspection modal.
  - Creator Question Studio (`/dashboard/questions`): Table layout with type/status filters, score, difficulty tags, and modal question review thread.
- **Admin Direct Question Approval**:
  - Backend: `directApproveDraft` admin procedure validates draft via shared `validateQuestionDraft()`, mints immutable `questionVersion`, cancels active assignments, creates completed admin assignment, links `currentVersionId`, and transitions `question.status` to `APPROVED`.
  - Frontend: "Approve to Bank" button in Question Studio table and "Approve to Question Bank" in Question Detail Modal & Review Thread with confirmation dialog.
  - Shared Client Helper: `src/lib/get-user-roles.ts` eliminates duplicated parsing logic.
- **AI Question Studio**: Gemini 2.5 and Groq BYOK key management, prompt-to-question generation, and test case drafting.

---

## 2. What is Currently in Progress

- All planned components for Admin Direct Approval are complete and typechecked. Ready for commit.

---

## 3. What is Broken or Unstable

- **None**: `pnpm exec tsc --noEmit` compiles cleanly with **0 errors**.

---

## 4. Areas to Avoid & Why

- **Direct DB schema edits without Drizzle migration**: Avoid writing custom raw SQL queries directly to Neon Postgres; all schema alterations must go through Drizzle ORM definitions in `src/server/db/`.
- **Student Exam Runner (`src/app/contest/[code]/`)**: Avoid changing student attempt timer or answer submission mechanisms unless tasked, as these affect live exam validity.

---

## 5. 5-Line Session Summary

- What was done: Implemented Admin Direct Question Approval with cancel-and-create assignment pattern, shared draft validation, shared client `getUserRoles`, and confirmation dialogs.
- What was committed: Pending commit for admin direct approval workflow.
- Build state: Verified `pnpm exec tsc --noEmit` with 0 type errors.
- What's left: Browser smoke test of direct approval flow and contest picker integration.
- What to watch out for: Direct approval cancels active assignments without deleting them, preserving the audit trail while moving questions straight to `APPROVED`.
