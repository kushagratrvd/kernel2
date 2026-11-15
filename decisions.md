# Decisions Log

> Rationale log for every meaningful technical choice, library selection, architecture pattern, and trade-off made across the codebase.
> Format: `[date] Decision: X over Y because Z`
> Note: AI model / author specified per decision for version tracking and reasoning provenance.

---

## 2026-11-15

### [2026-11-15] Decision: Option B (Spring Boot Backend Server-to-Server Integration with API Key Auth) over Option A (Direct Frontend React-to-Kernel Axios Calls) for CareerForge contest integration because server-to-server calls keep the API secret completely hidden from browser DevTools, prevent student identity/email spoofing (IDOR) by extracting verified email from CareerForge JWT, eliminate CORS vulnerabilities, and enable backend caching to protect Kernel from simultaneous student load.

- **Model**: Antigravity (Gemini 2.5 Pro)
- **Status**: IMPLEMENTED.
- **Decision Made**: Expose protected REST Route Handlers (`/api/v1/contests`, `/api/v1/contests/:code/leaderboard`, `/api/v1/students/:email/contests`) in Kernel Next.js App Router guarded by `X-Kernel-Api-Key` middleware. CareerForge's Spring Boot backend consumes these endpoints server-to-server and presents safe, cached proxies to the CareerForge React frontend.
- **Alternatives Considered**:
  1. Option A (Direct Frontend Integration): CareerForge React frontend calling Kernel REST API directly — rejected because API key is exposed in browser bundles/DevTools network tab, students can tamper with the `{email}` path parameter to inspect other students' scores (IDOR), and 500 concurrent students refreshing leaderboards directly hammer Kernel's database.
  2. Public unauthenticated REST endpoints — rejected because contest scorecards, participants, and leaderboards are sensitive academic records requiring authenticated cross-platform trust.
  3. Reusing tRPC for cross-platform integration — rejected because CareerForge backend is written in Java (Spring Boot 3.3.x) which natively consumes standard REST/JSON endpoints rather than tRPC batch RPC specifications.
- **Concrete Reason**: Option B provides complete cryptographic isolation of secrets, guarantees student identity integrity via CareerForge's existing JWT `UserPrincipal`, bypasses browser CORS constraints, and allows Spring Boot to throttle/cache leaderboard data.

### [2026-11-15] Decision: Student Contest Hub (`/contest`) with past participated contests and 'Enter Contest Code' modal over public live contest listings because contests are invitation-only classroom events where live exams should not be publicly discoverable without an authorized passcode, and students need a persistent portal to track past contest results, view holding statuses, and launch Monaco solution reviews.

- **Model**: User (Kushagra) + Antigravity (Gemini 3.8 Flash)
- **Status**: IMPLEMENTED.
- **Decision Made**: Redesigned `/contest` into a Student Contest Hub displaying earlier participated contests (`getStudentPastContests`), time-locked scores and ranks, direct shortcuts to scorecard and Monaco review workspace, and a prominent "Enter Contest Code" modal to join live contests with a passcode. Excluded public listings of live contests.
- **Alternatives Considered**:
  1. Showing a public feed of all active contests — rejected per user specification; live contests must be accessible only via invitation codes.
  2. Leaving `/contest` as a solitary code input form — rejected because students had no dashboard to revisit past attempts, view concluded contest ranks, or launch post-contest Monaco solution reviews.
- **Concrete Reason**: Provides students with a centralized hub for their academic contest history while strictly protecting contest privacy by requiring an authorized code to enter live exams.

### [2026-11-15] Decision: Replace native HTML `<select>` dropdowns with Base UI custom Popover Select components (`<Select>`, `<SelectTrigger>`, `<SelectContent>`, `<SelectItem>`) in live submissions feed because native OS dropdowns display sharp, unstyled, non-theme-responsive platform menus, whereas custom Base UI selects match application tokens, dark mode, and provide status color badges.

- **Model**: User (Kushagra) + Antigravity (Gemini 3.8 Flash)
- **Status**: IMPLEMENTED.
- **Decision Made**: Replaced native HTML `<select>` and `<option>` elements on `/dashboard/contests/submissions` with `@/components/ui/select` primitives (`Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`), providing themed floating popovers, rounded borders, and colored status dots.
- **Alternatives Considered**:
  1. Keeping native `<select>` — rejected because Windows/browser renders default unstyled OS popups with bright blue selection bars that break UI theme consistency.
  2. Custom dropdown state written from scratch — rejected because `@/components/ui/select` is already pre-configured with Base UI primitives, keyboard accessibility, and focus rings.
- **Concrete Reason**: Seamlessly unifies the filter bar aesthetics with the rest of the dark/light design system while providing immediate visual feedback through color-coded status badges.

### [2026-11-15] Decision: Post-contest result time-lock (`NOW() >= contest.endTime`) and dedicated fullscreen review workspace (`/contest/[code]/review`) with strict final attempt display and selective hidden test case failure diagnostics over immediate result release or inline accordions because early result releases leak solutions to active participants, while post-contest failure diagnostics enable learning without compromising future question integrity.

- **Model**: User (Kushagra) + Antigravity (Gemini 3.8 Flash)
- **Status**: DESIGN APPROVED — ready for implementation.
- **Decision Made**:
  1. Guarded `getResults` score, rank, and leaderboard fields behind `NOW() >= contest.endTime`. If contest is still running, students who finish early see only the count of attempted questions.
  2. Built a dedicated review workspace at `/contest/[code]/review` replicating the `/contest/[code]/attempt` layout with color-coded question pills (🟢 Correct, 🟡 Partial, 🔴 Incorrect, ⚪ Unattempted).
  3. Strict Final attempt code displayed in read-only Monaco editor, with explicit notification if the counted Best Score differed from the final attempt.
  4. Coding test case visibility: Sample test cases always visible; hidden test cases are revealed with inputs/expected/outputs *only if the student's submission failed on that hidden test case*.
- **Alternatives Considered**:
  1. Immediate full result release on finish attempt — rejected because students who finish 30 minutes early can share correct answers with classmates still taking the exam.
  2. Releasing all hidden test cases — rejected because it permanently leaks private test cases, preventing questions from being reused in future exams.
  3. Showing the best-scoring submission instead of the final submission — rejected based on user requirement to review the student's exact final code submission, with score reconciliation if best was higher.
- **Concrete Reason**: Enforces exam integrity during live contests while delivering a superior post-contest learning experience with exact final code retrospection and targeted failure debugging.

---

## 2026-11-14

### [2026-11-14] Decision: Dedicated AWS EC2 VPS with prebuilt Docker Hub containers over Render PaaS for CodeBox code runner sandbox because untrusted code execution requires host cgroups v2 (`cgroup: host`) and privileged container permissions (`privileged: true`) for Linux `isolate` sandboxing which unprivileged PaaS platforms reject.

- **Model**: User (Kushagra) + Antigravity (Gemini 3.8 Flash)
- **Status**: IMPLEMENTED.
- **Decision Made**: Configured CodeBox code execution runner on an AWS EC2 instance (`13.48.249.168`) using prebuilt Docker Hub images (`hiteshchoudhary/codebox-api`, `codebox-worker`, `redis`, `caddy`) with `cgroup: host` and `privileged: true` isolate sandboxing. Dispatched submission calls from Kernel2 (`src/server/codebox.ts` and `trpc.contest.submitCode`) via `CODEBOX_URL` and `CODEBOX_TOKEN`.
- **Alternatives Considered**:
  1. Hosting on Render / standard PaaS — rejected because PaaS containers run in restricted unprivileged environments without Docker socket (`/var/run/docker.sock`) or host cgroup v2 control, failing sandbox initialization.
  2. Building compiler images locally on EC2 (`gcc:9` Debian Bullseye) — rejected because Debian 11 Bullseye reached EOL causing 404 package errors during `unzip` apt fetch. Prebuilt Docker Hub worker already bundles compilers in Ubuntu 22.04 with `isolate`.
- **Concrete Reason**: Provides a production-grade, highly secure execution environment capable of evaluating submissions across Python, Node, C, C++, and Java with strict CPU/memory quotas and millisecond timing guarantees.

### [2026-11-14] Decision: Denormalize `contest_id` directly onto `submission` table with composite indexing over multi-table joins because contest live monitoring requires sub-second queries on `(contest_id, created_at)` without traversing `contest_participation`.

- **Model**: User (Kushagra) + Antigravity (Gemini 3.8 Flash)
- **Status**: IMPLEMENTED.
- **Decision Made**: Added `contestId` to `submission` table with composite index `(contest_id, created_at DESC)` and backfilled existing submissions using `contest_participation.contest_id`.
- **Alternatives Considered**:
  1. Leaving schema unchanged and joining `contest_participation` on every live feed tick — rejected because live polling every 4 seconds across dozens of simultaneous contests creates heavy cross-table join contention.
  2. Storing contest metadata in a Redis cache only — rejected because submissions must be durably stored and queryable with historical pagination.
- **Concrete Reason**: Enables index-only cursor scans (`WHERE contest_id = ? AND created_at > ?`) for ultra-fast polling without database strain.

### [2026-11-14] Decision: Bi-directional timestamp cursor live polling (`afterCursor` for prepends, `beforeCursor` for historical pagination) over offset pagination or WebSockets because polling with `afterCursor` guarantees zero skipped submissions during high-frequency ingestion without the operational overhead of a persistent WebSocket server.

- **Model**: User (Kushagra) + Antigravity (Gemini 3.8 Flash)
- **Status**: IMPLEMENTED.
- **Decision Made**: In `adminGetSubmissions`, implemented `afterCursor` (`WHERE created_at > afterCursor ORDER BY created_at ASC`) which client prepends to top of feed, and `beforeCursor` (`WHERE created_at < beforeCursor ORDER BY created_at DESC`) for loading older submissions.
- **Alternatives Considered**:
  1. Offset pagination (`page`, `pageSize`) — rejected because new submissions prepending at the top cause offset drift, resulting in duplicate or skipped rows on every poll.
  2. Persistent WebSockets / Server-Sent Events (SSE) — rejected because it introduces stateful connection tracking and infrastructure complexity while a 4-second cursor poll satisfies latency requirements with zero state overhead.
- **Concrete Reason**: Provides a jitter-free, seamless live feed where newly arriving submissions smoothly prepend without disrupting the admin's scroll position or missing records.

### [2026-11-14] Decision: Per-Student inspection drawer with problem pill selector and chronological attempts over per-problem modal because admins evaluate student performance contextually across all contest tasks.

- **Model**: User (Kushagra) + Antigravity (Gemini 3.8 Flash)
- **Status**: IMPLEMENTED.
- **Decision Made**: Built `<StudentSubmissionsDrawer />` keyed to `(contestId, userId)`. Header displays student summary and contest rank; top selector switches between all coding questions in the contest; body shows chronological attempt list with Monaco code viewer and failed test case diffs.
- **Alternatives Considered**:
  1. Per-problem drawer showing all students' submissions for one problem — rejected because admins diagnosing student behavior need to see all problems the student attempted, their progression across tasks, and total code attempts in that contest.
- **Concrete Reason**: Provides a holistic, comprehensive student view in a single slide-over drawer without requiring the admin to click into multiple modals or navigate away from the live feed.

### [2026-11-14] Decision: Store complete test case execution diagnostics (stdin, stdout, stderr, expected) in DB `execution_result` while returning sanitized results to the student runner because admins require deep debugging visibility while preventing private test case data leaks in client DevTools.

- **Model**: User (Kushagra) + Antigravity (Gemini 3.8 Flash)
- **Status**: IMPLEMENTED.
- **Decision Made**: In `submitCode`, full test case diagnostic records (`input`, `expectedOutput`, `stdout`, `stderr`, `compile_output`, `time`, `memory`, `passed`, `isSample`) are written to DB `submission.executionResult`. The client response continues to sanitize private test cases so students cannot inspect hidden test inputs/outputs in browser DevTools.
- **Alternatives Considered**:
  1. Returning full diagnostics to the student runner — rejected because it leaks hidden evaluation test cases, compromising contest integrity.
  2. Storing only pass/fail booleans in the DB — rejected because admins cannot diagnose why student code failed without seeing actual vs expected outputs.
- **Concrete Reason**: Satisfies both administrative diagnostic requirements and student-side examination security.

---

## 2026-10-01

### [2026-10-01] Decision: Unified Create/Edit Question Studio dialog with auto-prefilling and state recovery over dedicated separate edit page because reusing the comprehensive question authoring modal avoids code duplication, preserves inline taxonomy/markdown preview workflows, and provides instant transition between drafting and editing.

- **Model**: User (Kushagra) + Antigravity (Gemini 3.8 Flash)
- **Status**: IMPLEMENTED.
- **Decision Made**: Extended the existing Question Studio authoring dialog to dynamically support both creation and draft editing modes based on an `editingQuestionId` state. Populates all fields (`currentDraft`, `options`, `testCases`, `starterCode`, `difficulty`, `taxonomy`) when opening an existing draft or changes-requested question, locks `questionType` to preserve schema invariants, and executes `trpc.questionBank.updateDraft` upon submission.
- **Alternatives Considered**:
  1. Creating a separate `/dashboard/questions/[id]/edit` page — rejected because it adds routing complexity, unnecessary page transitions, and duplicates hundreds of lines of complex input/preview state management.
  2. In-place table cell editing — rejected because questions contain multi-paragraph markdown descriptions, complex MCQ option arrays, and multi-field test cases that require a spacious modal workspace.
- **Concrete Reason**: Provides creators with an immediate, cohesive authoring experience with zero layout shift, instant markdown preview, and consistent test case management across both creation and revision rounds.

---

## 2026-09-18

### [2026-09-18] Decision: Multi-role in-review question content editing for creators, assigned reviewers, and admins over strict creator-only draft locks because collaborative editing allows rapid typo correction and test case refinement without requiring full rejection-resubmission cycles.

- **Model**: User (Kushagra) + Antigravity (Google Gemini 3.8 Flash)
- **Status**: DESIGN — awaiting user approval of plan.
- **Decision Made**: Refactored question editing permissions (`updateDraft`) from `creatorProcedure` to `creatorOrReviewerProcedure`, allowing the question author (Creator), currently assigned Reviewer, or Admin to edit question content, options, and test cases while the question is actively under review (`UNDER_REVIEW`, `SUBMITTED_FOR_REVIEW`, `CHANGES_REQUESTED`, `DRAFT`). If an unapproved version snapshot is currently active, it is kept in sync with the edits so the approved version captures all corrections.
- **Alternatives Considered**:
  1. Restricting edits strictly to the Creator when status is `DRAFT` or `CHANGES_REQUESTED` only — rejected because reviewers often find trivial typos or need to tweak test case outputs directly rather than bouncing the question back and waiting days for the creator to make a single character fix.
  2. Forking a new version snapshot on every keystroke or save during review — rejected because it produces excessive version clutter; intermediate edits during an active review cycle belong to the pending revision round.
- **Concrete Reason**: Streamlines question curation in fast-paced exam preparation environments. Reviewers and admins can collaborate directly with creators on the problem statement and test cases while maintaining a clear audit trail via optional discussion thread revision notes (`reviewComment`).

### [2026-09-18] Decision: Admin hard-reject from any active status with recoverable `REJECTED → DRAFT` path over terminal rejection or introducing a new `CANCELLED` question status because recoverable rejection preserves rework opportunity and `CANCELLED` is already an assignment-level concept.

- **Model**: User (Kushagra) + Antigravity (Opus 4.6 & Gemini 3.8 Flash)
- **Status**: IMPLEMENTED.
- **Decision Made**: Admins can reject a question from **any active status** (`DRAFT`, `SUBMITTED_FOR_REVIEW`, `UNDER_REVIEW`, `CHANGES_REQUESTED`, `APPROVED`) → `REJECTED`. The `REJECTED` status is **recoverable**: an admin can subsequently move a rejected question back to `DRAFT` for the creator to rework. Active assignments (`PENDING`/`IN_REVIEW`) are cancelled using the established cancel-and-create pattern, and a completed admin assignment is inserted with the rejection reason as a `reviewComment`.
- **Alternatives Considered**:
  1. Using `CANCELLED` as the question-level terminal status — rejected because `CANCELLED` is already the assignment-level status in `questionAssignment` and overloading it creates semantic confusion.
  2. Making `REJECTED` terminal (no recovery) — rejected because questions are often rejected for fixable reasons (ambiguous wording, missing options), and forcing creators to re-create from scratch wastes effort and loses version history.
  3. Using `ARCHIVED` for admin rejection of approved questions — rejected because `ARCHIVED` semantically means "was valid but shelved from future use", not "has quality/correctness problems".
- **Semantic Distinction**:
  | Action | Status | Entry From | Recovers To | Meaning |
  |---|---|---|---|---|
  | Needs creator fixes (reviewer feedback) | `CHANGES_REQUESTED` | `UNDER_REVIEW` | `DRAFT` (creator resubmits) | Soft bounce back to creator |
  | Not currently acceptable (admin override) | `REJECTED` | Any active status | `DRAFT` (admin restores) | Hard stop, but recoverable for rework |
  | Was valid but shelved from active pool | `ARCHIVED` | `APPROVED` only | `APPROVED` (admin restores) | Hidden from future contest creation, not deleted |
  | Valid and available for contests | `APPROVED` | Review/Admin approval | `ARCHIVED` or `REJECTED` | In the Question Bank |
- **ARCHIVED Lifecycle**: `ARCHIVED` can only be reached from `APPROVED` (a question must have been reviewed and accepted before it can be shelved). An archived question can be restored directly back to `APPROVED` without re-review, since the immutable `questionVersion` snapshot is still valid. This gives admins a non-destructive way to remove questions from the contest pool temporarily.
- **Contest Safety**: Rejecting or archiving an `APPROVED` question does NOT invalidate existing `contestQuestion` rows because contests reference immutable `questionVersion` snapshots, not the live `question.status`. Rejected/archived questions simply stop appearing in `listQuestionBank` (which filters `status = "APPROVED"`).

### [2026-09-18] Decision: Cancel-and-create assignment pattern for admin direct approval over mutating active reviewer assignments because preserving past assignments maintains reviewer accountability and immutable audit history.

- **Model**: Antigravity (Google Gemini 3.8 Flash)
- **Decision Made**: Implemented `directApproveDraft` in `questionBankRouter` using `adminProcedure`. When an administrator directly approves a question that is in `DRAFT`, `CHANGES_REQUESTED`, `SUBMITTED_FOR_REVIEW`, or `UNDER_REVIEW`, any active assignment is marked as `CANCELLED` (rather than mutating or overwriting the original reviewer ID), a new `COMPLETED` assignment is created for the approving administrator, an immutable `questionVersion` snapshot is minted from `currentDraft`, and the question status is transitioned to `APPROVED`.
- **Alternatives Considered**:
  1. Forcing admins to go through the peer-review assignment cycle (assigning themselves or waiting on a reviewer).
  2. Mutating the existing `questionAssignment` row by changing its `reviewerId` from the assigned reviewer to the admin.
  3. Setting `question.status = "APPROVED"` directly without creating a `questionVersion` or assignment.
- **Concrete Reason**:
  1. Admins preparing contests often curate or author their own questions and need to publish directly to the Question Bank without artificial delay.
  2. Overwriting or mutating an existing active reviewer assignment would corrupt review history (making it look like the original reviewer never had the question assigned). Cancelling the old assignment (`status = "CANCELLED"`) and inserting a new completed assignment (`status = "COMPLETED"`) for the admin cleanly preserves reviewer accountability while reflecting the administrator override.
  3. Contests strictly require questions to reference immutable `questionVersion` snapshots (`currentVersionId`). Without minting a snapshot, draft edits could introduce breaking changes or contest inconsistencies.

### [2026-09-18] Decision: Extract client-safe `getUserRoles` into `src/lib/get-user-roles.ts` over duplicating JSON parsing inline across UI components because centralized role extraction ensures uniform permission checks without server-side import leaks.

- **Model**: Antigravity (Google Gemini 3.8 Flash)
- **Decision Made**: Created `src/lib/get-user-roles.ts` to parse user roles from Better Auth session payloads (handling arrays, stringified JSON arrays, and legacy single role strings) and refactored `dashboard/page.tsx`, `contests/layout.tsx`, `questions/page.tsx`, and `question-detail-modal.tsx` to use it.
- **Alternatives Considered**: Importing `getUserRoles` from `src/server/trpc/init.ts` in client components, or duplicating the 12-line helper function in every client component.
- **Concrete Reason**: `src/server/trpc/init.ts` contains server-only dependencies and cannot be imported into `"use client"` files. Duplicating the parser inline led to maintenance hazards and risk of divergence when role serialization formats change.

### [2026-09-18] Decision: Restrict contest visibility and management endpoints exclusively to `admin` over `creator` / `reviewer` because contest scheduling and curation are platform governance operations.

- **Commit**: `50582fc` (`feat: restrict contests access and visibility exclusively to admin`)
- **Model**: Antigravity (Gemini 2.5)
- **Decision Made**: Restricted `listAll`, `create`, `getForEdit`, `addQuestion`, `removeQuestion`, `deleteQuestion`, `updateQuestion`, and `update` in `contestRouter` to `adminProcedure`, guarded all `/dashboard/contests/*` routes using `ContestsAdminLayout`, and removed all contest cards, creation buttons, and overview tables from Creator and Reviewer dashboards.
- **Alternatives Considered**: Allowing creators to view active contests or draft contests they created.
- **Concrete Reason**: The `creator` role is strictly designed for authoring, drafting, AI-generating, and revising questions in the Question Studio. The `reviewer` role is focused entirely on verification, feedback, and approving questions into the bank. Allowing creators/reviewers to see or create contests cluttered their workflows and caused privilege ambiguity.

### [2026-09-18] Decision: Extract `QuestionStatusBadge` and `ReviewDiscussionThread` into reusable components under `src/components/questions/` over keeping inlined JSX in reviews and questions pages because centralized components prevent visual styling drift and eliminate code duplication.

- **Commit**: `251ef29` (`refactor: extract QuestionStatusBadge and ReviewDiscussionThread into reusable components`)
- **Model**: Antigravity (Gemini 2.5)
- **Decision Made**: Extracted `<QuestionStatusBadge />`, `<ReviewAssignmentStatusBadge />`, and `<ReviewDiscussionThread />` as standalone drop-in components preserving exact CSS classes and color tokens.
- **Alternatives Considered**: Keeping inlined JSX implementations in both `src/app/dashboard/reviews/page.tsx` and `src/app/dashboard/questions/page.tsx`.
- **Concrete Reason**: Inlined badges and discussion timeline feeds were prone to subtle divergences in padding, badge pulse animations, and comment bubble alignments. A single shared component guarantees exact visual consistency across the platform.

### [2026-09-18] Decision: Unified question-level status and discussion thread for review history over splitting question verdicts across separate assignment rows because continuous conversational context is preserved across multiple revisions.

- **Commit**: `1f84975` (`feat: enhance reviewer desk and question studio with table layout, accurate review history status, and chat thread`)
- **Model**: Antigravity (Gemini 2.5)
- **Decision Made**: Leveraged the central `question.status` (`CHANGES_REQUESTED`, `APPROVED`, `REJECTED`, `UNDER_REVIEW`, `DRAFT`) for the live verdict and deduplicated review history entries by `questionId` to display the unified review thread.
- **Alternatives Considered**: Adding a separate `reviewDecision` column (`APPROVED | CHANGES_REQUESTED | REJECTED`) on `questionAssignment`.
- **Concrete Reason**: Questions already retain a continuous conversation and feedback thread between creators and reviewers regardless of how many version snapshots are minted. Adding a redundant column to `questionAssignment` would require database migrations and risk data divergence between assignment rows and the core question state.

---

## 2026-09-17

### [2026-09-17] Decision: Bring-Your-Own-Key (BYOK) AES-256 encrypted user API keys for Gemini and Groq AI question generation over shared server environment API keys because individual user keys eliminate server rate-limit bottlenecks and cost risks.

- **Commit**: `ff479af` (`feat: AI question generator with Gemini and Groq, on-demand Codebox test runs, and markdown image support`)
- **Model**: Antigravity (Gemini 2.5)
- **Decision Made**: Created `userApiKey` table with AES-256 encryption (`src/lib/encryption.ts`) and implemented `aiRouter` supporting Groq LLaMA models and Google Gemini 2.5 Pro/Flash models.
- **Alternatives Considered**: Using a single server-wide `GEMINI_API_KEY` or `GROQ_API_KEY`.
- **Concrete Reason**: Multi-tenant creators generating batches of questions would quickly deplete shared server quotas. BYOK with encrypted database persistence gives creators flexibility over model selection without shared quota failures.

### [2026-09-17] Decision: In-dashboard user management with dynamic multi-role assignment over external auth dashboard administration because platform administrators need real-time control over creator and reviewer privileges.

- **Commit**: `4afc230` (`feat: admin user management, reviewer desk enhancements, question picker redesign`)
- **Model**: Antigravity (Gemini 2.5)
- **Decision Made**: Built `/dashboard/admin/users` with real-time role toggling (`adminProcedure.addRole` / `removeRole`), user creation, and status filtering.
- **Alternatives Considered**: Managing user roles manually via database SQL queries or external Better Auth admin portals.
- **Concrete Reason**: Role upgrades (e.g. promoting a creator to reviewer or activating test creator accounts) happen frequently during contest preparation and require an integrated UI with auditability.

### [2026-09-17] Decision: Decoupled contest question marks via `contestQuestion.marks` over enforcing immutable `questionScore` from the Question Bank because contest organizers require flexibility to weight problems differently per contest.

- **Commit**: `acccfc1` (`feat(contests): widescreen question picker dialog with teacher-decided marks`)
- **Model**: Antigravity (Gemini 2.5)
- **Decision Made**: Added customizable `marks` on `contestQuestion` which defaults to `version.questionScore` but allows instructor override in the widescreen question picker.
- **Alternatives Considered**: Forcing all contests to use the default `questionScore` stored on the Question Bank snapshot.
- **Concrete Reason**: A calculus problem might be worth 10 points in a weekly quiz but 25 points in a comprehensive final contest. Decoupling marks allows reuse of the same approved question version across different exams without altering the original Question Bank record.

---

## 2026-09-13

### [2026-09-13] Decision: Immutable `questionVersion` snapshots on review submission over direct in-place question editing because immutable versions prevent race conditions and guarantee exam integrity.

- **Commit**: `7bc08d3` (`implemented the multi-role Question Bank system featuring Creator and Reviewer workflows, immutable Question Version Snapshots, contest snapshot decoupling, taxonomy management, and system-wide audit logging`)
- **Model**: Kushagra / Antigravity (Claude 3.5 Sonnet / Gemini)
- **Decision Made**: Implemented two-tier question architecture: mutable working drafts (`questionDraft`) for ongoing creator edits, and immutable snapshots (`questionVersion`) minted only when submitted for review or attached to contests.
- **Alternatives Considered**: Storing questions in a single mutable table and updating drafts in place.
- **Concrete Reason**: If a creator updates a question while a reviewer is actively evaluating it or while a contest is underway, the evaluation and student attempts become invalid. Splitting mutable drafts from immutable snapshots guarantees version consistency and repeatability.

---

## 2026-07-24

### [2026-07-24] Decision: Neutral/black monochrome UI styling for submission success states over saturated bright green colors because clean minimal aesthetics improve focus and reduce visual fatigue in test-taking environments.

- **Commit**: `a234ac7` (`updated all green styling elements associated with finishing a contest, submitting successfully, and viewing the results to be black/neutral`)
- **Model**: Kushagra
- **Decision Made**: Standardized contest attempt completion and submission result dialogs to use high-contrast monochrome tokens (`text-foreground`, `bg-foreground`) instead of neon green badges.
- **Alternatives Considered**: Standard vibrant green success banners and alert boxes.
- **Concrete Reason**: Saturated green banners were visually distracting during intensive examination flows and clashed with the sleek dark/light mode aesthetic of the platform.

---

## 2026-07-07

### [2026-07-07] Decision: Remote Codebox sandbox execution over local Node.js `child_process` or Docker containers because untrusted student code execution requires complete isolation.

- **Commit**: `ca93bc0` (`feat: implement contest attempt interface with code execution, MCQ support, and progress persistence`)
- **Model**: Kushagra / Antigravity
- **Decision Made**: Integrated a remote Codebox execution service (`src/server/codebox.ts`) with configurable memory limits, time limits, and multi-language runtimes.
- **Alternatives Considered**: Running user-submitted code in local Node.js `child_process` or local Docker daemon.
- **Concrete Reason**: Code execution in programming contests involves malicious code risks, fork bombs, and excessive memory consumption. An external isolated Codebox sandbox with rigid timeout and memory caps safeguards the web application server.

---

## 2026-07-06

### [2026-07-06] Decision: Better Auth with Drizzle adapter and multi-role array schema over NextAuth / Auth.js because Better Auth provides native TypeScript inference, clean session cookies, and flexible custom schema extension.

- **Commit**: `4fe5895` (`feat: implement authentication system using Better Auth with email sign-in page and protected routes`)
- **Model**: Kushagra
- **Decision Made**: Selected Better Auth with PostgreSQL Drizzle adapter, storing user roles as an array to allow composite privileges (`["creator", "reviewer", "admin"]`).
- **Alternatives Considered**: NextAuth v5 (Auth.js) or Supabase Auth.
- **Concrete Reason**: Better Auth integrates directly with Drizzle ORM schemas and allows easy extension for array-based role structures parsed via `getUserRoles(user)`, enabling users to hold composite permissions seamlessly.

---

## 2026-07-04

### [2026-07-04] Decision: End-to-end type-safe tRPC with TanStack React Query over REST API routes because tRPC eliminates API client boilerplate and catches type mismatches at compile time.

- **Commit**: `38ecb54` (`feat: initialize tRPC backend infrastructure with Drizzle ORM and environment validation`)
- **Model**: Kushagra
- **Decision Made**: Initialized tRPC backend infrastructure (`src/server/trpc/`) with React Query hooks and context middleware (`adminProcedure`, `creatorProcedure`).
- **Alternatives Considered**: Standard Next.js route handlers (`/api/contests`, `/api/questions`) with manual `fetch` calls.
- **Concrete Reason**: tRPC provides instant autocompletion, automatic request batching, and guarantees compile-time synchronization between server procedures and client UI components.
