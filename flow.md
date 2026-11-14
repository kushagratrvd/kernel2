# Execution Flow Map

> Maps how execution travels across the codebase for major system flows: entry points, function call sequences, module handoffs, and database interactions.

---

## 1. Question Authoring & AI Generation Flow

```
[ Creator ]
    │
    │  1. Types question details OR prompts AI generator
    ▼
[ UI: /dashboard/questions or /dashboard/questions/ai ]
    │
    │  2. Calls create() or saveGeneratedQuestions()
    ▼
[ TRPC: questionBankRouter / aiRouter ]
    │
    │  3. Middleware checks session & role ("creator" | "admin")
    ▼
[ Auth Middleware: creatorProcedure ]
    │
    │  4. INSERT INTO "question" (status='DRAFT')
    │     INSERT INTO "questionDraft" (options, testCases, hint, etc.)
    ▼
[ PostgreSQL (Drizzle ORM) ]
    │
    │  5. Returns created record with DRAFT status badge
    ▼
[ Creator Studio Table ]
```

- **Entry Point**: [`src/app/dashboard/questions/page.tsx`](file:///d:/contest-platform/src/app/dashboard/questions/page.tsx) or [`src/app/dashboard/questions/ai/page.tsx`](file:///d:/contest-platform/src/app/dashboard/questions/ai/page.tsx)
- **Functions Called**:
  - `createMutation.mutateAsync({ title, description, questionType, difficulty, ... })`
  - `trpc.questionBank.create` in [`src/server/trpc/routers/question-bank.ts`](file:///d:/contest-platform/src/server/trpc/routers/question-bank.ts)
  - Alternatively: `trpc.ai.generateQuestions` and `trpc.ai.saveGeneratedQuestions` in [`src/server/trpc/routers/ai.ts`](file:///d:/contest-platform/src/server/trpc/routers/ai.ts)
- **Middleware Chain**: `protectedProcedure` -> `creatorMiddleware` (`src/server/trpc/init.ts`) ensuring `roles.includes("creator") || roles.includes("admin")` and user is active.
- **Database Tables Touched**:
  - `question`: New row with `status = "DRAFT"`, `createdById = ctx.user.id`.
  - `questionDraft`: Stores options, test cases, hint, starter code, time/memory limits.

### 1.1 Question Draft Editing Flow

```
[ Creator / Admin ]
    │
    │  1. Clicks "Edit Draft" in Table or Detail Modal (status in DRAFT | CHANGES_REQUESTED)
    ▼
[ UI: Question Studio Modal in Edit Mode ]
    │
    │  2. Form prefilled with currentDraft, options, testCases, taxonomy
    │  3. User edits fields and clicks "Save Changes"
    ▼
[ TRPC: questionBankRouter.updateDraft ]
    │
    │  4. Checks ownership (createdById === ctx.user.id || isAdmin)
    │  5. Verifies status in ('DRAFT', 'CHANGES_REQUESTED')
    │  6. UPDATE "question" SET current_draft = payload, updated_at = NOW()
    ▼
[ PostgreSQL (Drizzle ORM) ]
    │
    │  7. Returns updated question record
    ▼
[ UI: Closes modal, invalidates listMyQuestions cache, shows success toast ]
```

---

## 2. Question Submission & Immutable Snapshot Minting Flow

```
[ Creator ]
    │
    │  1. Selects Reviewer & writes optional submission note
    ▼
[ UI: Submit to Reviewer Dialog ]
    │
    │  2. submitForReview({ questionId, reviewerId, comment })
    ▼
[ TRPC: questionBankRouter.submitForReview ]
    │
    │  3. BEGIN PostgreSQL Transaction
    ▼
[ Database Transaction ]
    ├──> a. Query latest version number: (lastVersion?.version ?? 0) + 1
    ├──> b. INSERT INTO "questionVersion" (immutable v1, v2 snapshot)
    ├──> c. UPDATE "question" SET status='SUBMITTED_FOR_REVIEW', currentVersionId=version.id
    ├──> d. INSERT INTO "questionAssignment" (status='PENDING', reviewerId, assignedAt=NOW())
    └──> e. INSERT INTO "questionComment" (initial creator note if provided)
    │
    │  4. COMMIT Transaction
    ▼
[ Reviewer Queue & Question Studio Table ]
    ├──> Creator UI: Question status updates to "Submitted"
    └──> Reviewer Desk: Assignment appears as "Pending Pickup"
```

- **Entry Point**: "Submit to Reviewer" action in [`src/app/dashboard/questions/page.tsx`](file:///d:/contest-platform/src/app/dashboard/questions/page.tsx)
- **Function Called**: `trpc.questionBank.submitForReview` in [`src/server/trpc/routers/question-bank.ts`](file:///d:/contest-platform/src/server/trpc/routers/question-bank.ts)
- **Execution Order**:
  1. Validates question completeness (e.g. MCQ has at least 2 options and a correct answer; code question has test cases).
  2. Queries `questionVersion` table to compute `nextVersionNumber = (lastVersion?.version ?? 0) + 1`.
  3. Inserts an immutable row into `questionVersion` copying current draft fields.
  4. Updates `question` setting `currentVersionId = versionId` and `status = 'SUBMITTED_FOR_REVIEW'`.
  5. Inserts a row into `questionAssignment` (`status = 'PENDING'`, `reviewerId = input.reviewerId`, `assignedAt = NOW()`).
  6. If a submission comment was provided, inserts a row into `questionComment`.

---

## 3. Reviewer Desk Inspection & Interactive Discussion Flow

```
[ Reviewer ]
    │
    │  1. Opens /dashboard/reviews -> clicks "Pick Up"
    ▼
[ UI: Reviewer Desk Table ]
    │
    │  2. Calls trpc.questionBank.startReview({ assignmentId })
    ▼
[ TRPC: questionBank.startReview ]
    │
    │  3. UPDATE "questionAssignment" SET status='IN_REVIEW'
    ▼
[ Database: questionAssignment ]
    │
    │  4. Reviewer clicks row -> opens Inspection Modal
    ▼
[ UI: <ReviewDiscussionThread /> ]
    │
    │  5. Queries trpc.questionBank.getReviewThread({ questionId })
    ▼
[ TRPC: questionBank.getReviewThread ]
    │
    │  6. Joins questionComment with user profiles (Creator vs Reviewer)
    ▼
[ Discussion Stream ] ◄───► [ Interactive Reply Box ]
  (Reviewer and Creator exchange messages via trpc.questionBank.addComment)
```

- **Entry Points**:
  - [`src/app/dashboard/reviews/page.tsx`](file:///d:/contest-platform/src/app/dashboard/reviews/page.tsx)
  - [`src/components/questions/review-discussion-thread.tsx`](file:///d:/contest-platform/src/components/questions/review-discussion-thread.tsx)
  - [`src/components/questions/question-status-badge.tsx`](file:///d:/contest-platform/src/components/questions/question-status-badge.tsx)
- **Functions Called**:
  - `trpc.questionBank.listAssigned` / `listHistory`: fetches reviewer's active and completed reviews.
  - `trpc.questionBank.startReview`: transitions assignment from `PENDING` to `IN_REVIEW`.
  - `trpc.questionBank.getReviewThread`: fetches full conversation history for the question.
  - `trpc.questionBank.addComment`: appends comment by reviewer or creator.

---

## 4. Review Verdict Finalization Flow

```
                    [ Reviewer Decides Verdict ]
                                 │
           ┌─────────────────────┼─────────────────────┐
           ▼                     ▼                     ▼
     [ "Approve" ]      [ "Request Changes" ]     [ "Reject" ]
           │                     │                     │
           │                     │                     │
           ▼                     ▼                     ▼
  completeReview({      completeReview({      completeReview({
    verdict: "APPROVED"   verdict: "CHANGES_    verdict: "REJECTED"
  })                        REQUESTED", message })
           │                     │                     │
           ▼                     ▼                     ▼
  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
  │ assignment:     │   │ assignment:     │   │ assignment:     │
  │   COMPLETED     │   │   COMPLETED     │   │   COMPLETED     │
  │ question:       │   │ question:       │   │ question:       │
  │   APPROVED      │   │   CHANGES_REQ   │   │   REJECTED      │
  │ comment:        │   │ comment:        │   │ comment:        │
  │   approval note │   │   reviewer note │   │   rejection note│
  └─────────────────┘   └─────────────────┘   └─────────────────┘
           │                     │                     │
           ▼                     ▼                     ▼
  Available for Contests  Creator edits & clicks   Terminal state
  in Question Bank        "Re-submit to Reviewer"
```

- **Entry Point**: Decision action buttons in [`src/app/dashboard/reviews/page.tsx`](file:///d:/contest-platform/src/app/dashboard/reviews/page.tsx)
- **Function Called**: `trpc.questionBank.completeReview` in [`src/server/trpc/routers/question-bank.ts`](file:///d:/contest-platform/src/server/trpc/routers/question-bank.ts)
- **Execution Branches**:
  - **Verdict: `APPROVED`**:
    - Updates `questionAssignment` (`status = 'COMPLETED'`, `completedAt = NOW()`).
    - Updates `question` (`status = 'APPROVED'`).
    - Inserts approval note into `questionComment`.
    - Result: Question enters the live Question Bank, making it selectable by Admins for contests.
  - **Verdict: `CHANGES_REQUESTED`**:
    - Updates `questionAssignment` (`status = 'COMPLETED'`, `completedAt = NOW()`).
    - Updates `question` (`status = 'CHANGES_REQUESTED'`).
    - Inserts reviewer feedback into `questionComment`.
    - Result: Creator is notified in Question Studio, edits draft in `QuestionDetailModal`, and clicks "Re-submit to Reviewer".
  - **Verdict: `REJECTED`**:
    - Updates `questionAssignment` (`status = 'COMPLETED'`).
    - Updates `question` (`status = 'REJECTED'`).

---

## 5. Admin Direct Review & Approval Flow

```
[ Admin ]
    │
    │  1. Clicks "Approve to Question Bank" in Table or Detail Modal
    ▼
[ UI: Confirmation Dialog ]
    │  "This will approve the current draft and create an immutable
    │   question version. Any active peer-review assignment will be cancelled."
    │
    │  2. Calls directApproveDraft({ questionId, comment })
    ▼
[ TRPC: questionBankRouter.directApproveDraft ]
    │
    │  3. Middleware checks admin role (adminProcedure)
    ▼
[ Shared Validator: validateQuestionDraft() ]
    │  - Checks title, description non-empty
    │  - MCQ: >=2 options, unique option IDs, correctOptionId exists, non-empty text
    │  - Code: >=1 test case with input & expectedOutput
    │
    │  4. BEGIN PostgreSQL Transaction
    ▼
[ Database Transaction ]
    ├──> a. Query latest version number: (lastVersion?.version ?? 0) + 1
    ├──> b. INSERT INTO "questionVersion" (immutable snapshot from currentDraft)
    ├──> c. UPDATE "questionAssignment" SET status='CANCELLED' (where status IN ('PENDING', 'IN_REVIEW'))
    ├──> d. INSERT INTO "questionAssignment" (status='COMPLETED', reviewerId=adminId, versionId)
    ├──> e. UPDATE "question" SET status='APPROVED', currentVersionId=version.id
    ├──> f. INSERT INTO "reviewComment" (admin verification note)
    └──> g. INSERT INTO "auditLog" (action='ADMIN_DIRECT_APPROVED')
    │
    │  5. COMMIT Transaction
    ▼
[ Live Question Bank ]
    ├──> Question immediately available in Question Bank
    ├──> Selectable by Contest QuestionPickerDialog
    └──> Full audit trail & assignment history preserved
```

- **Entry Points**:
  - Table action button in [`src/app/dashboard/questions/page.tsx`](file:///d:/contest-platform/src/app/dashboard/questions/page.tsx)
  - Header button / Review thread action in [`src/app/dashboard/questions/question-detail-modal.tsx`](file:///d:/contest-platform/src/app/dashboard/questions/question-detail-modal.tsx)
- **Function Called**: `trpc.questionBank.directApproveDraft` in [`src/server/trpc/routers/question-bank.ts`](file:///d:/contest-platform/src/server/trpc/routers/question-bank.ts)
- **Validator**: `validateQuestionDraft(draft, questionType)` in [`src/server/trpc/routers/question-bank.ts`](file:///d:/contest-platform/src/server/trpc/routers/question-bank.ts)
- **Security Check**: Enforced by `adminProcedure` in [`src/server/trpc/init.ts`](file:///d:/contest-platform/src/server/trpc/init.ts).
- **Execution Invariant**: Guarantees that any APPROVED question possesses an immutable `questionVersion` snapshot and can be safely referenced by contests without draft mutation side-effects.

---

## 6. Contest Lifecycle Flow (Admin Only)

```
[ User attempts to navigate /dashboard/contests/* ]
    │
    ▼
[ ContestsAdminLayout (Route Guard) ]
    │
    ├──> If NOT Admin ──> router.replace("/dashboard") (Blocked)
    │
    └──> If Admin
            │
            ▼
    [ Admin Contest UI ]
            │
            │  1. contest.create({ code, title, startTime, endTime, totalTime })
            ▼
    [ TRPC: contestRouter (adminProcedure) ]
            │
            │  2. INSERT INTO "contest"
            ▼
    [ QuestionPickerDialog ]
            │
            │  3. contest.addQuestion({ contestId, questionId, marks })
            ▼
    [ Verification: question.status === 'APPROVED' ]
            │
            │  4. INSERT INTO "contestQuestion" (uses questionVersion snapshot)
            │     UPDATE "contest" (recalculate totalQuestions, totalScore)
            ▼
    [ Contest Live & Ready for Students ]
```

- **Entry Points**:
  - [`src/app/dashboard/contests/layout.tsx`](file:///d:/contest-platform/src/app/dashboard/contests/layout.tsx)
  - [`src/app/dashboard/contests/new/page.tsx`](file:///d:/contest-platform/src/app/dashboard/contests/new/page.tsx)
  - [`src/app/dashboard/contests/[id]/page.tsx`](file:///d:/contest-platform/src/app/dashboard/contests/[id]/page.tsx)
  - [`src/components/contests/question-picker-dialog.tsx`](file:///d:/contest-platform/src/components/contests/question-picker-dialog.tsx)
- **Functions Called**:
  - `trpc.contest.listAll` (admin only)
  - `trpc.contest.create` (admin only)
  - `trpc.contest.getForEdit` (admin only)
  - `trpc.contest.addQuestion` (admin only)
  - `trpc.contest.removeQuestion` (admin only)
- **Security Check**:
  - Enforced by `adminProcedure` in [`src/server/trpc/init.ts`](file:///d:/contest-platform/src/server/trpc/init.ts).
  - Enforced on client by [`src/app/dashboard/contests/layout.tsx`](file:///d:/contest-platform/src/app/dashboard/contests/layout.tsx) which redirects non-admins.

---

## 7. Student Contest Participation & Codebox Runner Flow

```
[ Student: /contest ]
    │
    │  1. Enters contest code
    ▼
[ contest.getByCode({ code }) + contest.join({ contestId }) ]
    │
    │  2. INSERT INTO "contestParticipation" (score=0, joinedAt=NOW())
    ▼
[ Student Workspace: /contest/[code] ]
    │
    │  3. contest.startAttempt({ contestId }) -> sets startedAt=NOW()
    │
    ├──> MCQ / Text Questions:
    │      submitMcqOrTextAnswer() ──> Validates against version snapshot ──> Saves score
    │
    └──> Code Questions:
           │
           ├──> Test Run: executeCodeTest() ──> Codebox sandbox ──> Returns stdout/stderr
           │
           └──> Submit Code: submitCode()
                  │
                  ▼
                [ Codebox Service (Remote Sandbox) ]
                  │ (Runs all private test cases within time & memory limits)
                  ▼
                [ Score & Submission Log recorded in DB ]
    │
    │  4. contest.finishAttempt()
    ▼
[ Attempt finalized, rank and results computed ]
```

- **Entry Point**: [`src/app/contest/page.tsx`](file:///d:/contest-platform/src/app/contest/page.tsx) -> [`src/app/contest/[code]/page.tsx`](file:///d:/contest-platform/src/app/contest/[code]/page.tsx)
- **Functions Called**:
  - `trpc.contest.getByCode`: fetches contest metadata and questions ordered by `questionOrder`.
  - `trpc.contest.join`: records `contestParticipation` record (`score = 0`).
  - `trpc.contest.startAttempt`: sets `startedAt = NOW()`.
  - `trpc.contest.submitMcqOrTextAnswer`: validates student response against version snapshot and scores points.
  - `trpc.contest.executeCodeTest`: calls `executeSubmission()` in [`src/server/codebox.ts`](file:///d:/contest-platform/src/server/codebox.ts) for live compilation and execution against sample test cases.
  - `trpc.contest.submitCode`: runs all hidden test cases via Codebox, records submission rows, and computes total problem score.
  - `trpc.contest.finishAttempt`: sets `finishedAt = NOW()`, computes final contest ranking.

---

## 7. Admin Question Lifecycle Controls Flow (Reject, Recover to Draft, Archive & Unarchive)

```
                       [ Question in Any Status ]
                                    │
               ┌────────────────────┼────────────────────┐
               ▼                    ▼                    ▼
       [ "Admin Reject" ]   [ "Restore Draft" ]   [ "Archive / Unarchive" ]
               │                    │                    │
   (Any active status except   (Status must be     (ARCHIVED: only from APPROVED;
    ARCHIVED/REJECTED)          REJECTED)           UNARCHIVED: returns to APPROVED)
               │                    │                    │
               ▼                    ▼                    ▼
       adminReject({        adminRestoreToDraft({  archiveQuestion({ questionId })
         questionId,          questionId,          unarchiveQuestion({ questionId })
         reason               comment })                 │
       })                           │                    │
               │                    │                    │
               ▼                    ▼                    ▼
      PostgreSQL TX:       PostgreSQL TX:        PostgreSQL:
      ├── CANCEL active    ├── UPDATE question   ├── UPDATE question
      │   assignments          status='DRAFT'        status='ARCHIVED' / 'APPROVED'
      ├── If versioned,    ├── If comment,       └── auditLog
      │   INSERT COMPLETED     add note to thread
      │   admin assignment └── auditLog
      ├── INSERT review
      │   comment
      ├── UPDATE question
      │   status='REJECTED'
      └── auditLog
               │                    │                    │
               ▼                    ▼                    ▼
      Halted & hidden from   Creator can edit     Non-destructively shelved
      active Question Bank;  draft & re-submit    from future contest selection;
      recoverable by Admin   for review           existing contests unaffected
```

- **Entry Points**:
  - Table action buttons & confirmation dialogs in [`src/app/dashboard/questions/page.tsx`](file:///d:/contest-platform/src/app/dashboard/questions/page.tsx)
  - Header action buttons & dialogs in [`src/app/dashboard/questions/question-detail-modal.tsx`](file:///d:/contest-platform/src/app/dashboard/questions/question-detail-modal.tsx)
- **Functions Called**:
  - `trpc.questionBank.adminReject`: transitions question to `REJECTED`, cancels active peer assignments, creates completed admin assignment (if versioned), and appends rejection reason to discussion thread.
  - `trpc.questionBank.adminRestoreToDraft`: transitions question from `REJECTED` back to `DRAFT`, allowing author to revise `currentDraft` and resubmit.
  - `trpc.questionBank.archiveQuestion`: transitions question from `APPROVED` to `ARCHIVED`, hiding it from future contest creation while preserving existing `contestQuestion` references.
  - `trpc.questionBank.unarchiveQuestion`: transitions question from `ARCHIVED` directly back to `APPROVED` without requiring re-review.
---

## 8. Admin Code Submissions Monitoring & Inspection Flow

```
[ Admin ]
    │
    ├──> 1. Opens Global Feed: /dashboard/contests/submissions
    │      │
    │      ├──> Auto-poll every 4s with afterCursor: trpc.contest.adminGetSubmissions
    │      └──> Filters: Contest, Status, Student Search
    │
    ├──> 2. Or opens Contest Detail: /dashboard/contests/[id]
    │      │
    │      ├──> Submissions Tab: trpc.contest.adminGetSubmissions({ contestId })
    │      └──> Participants Tab: trpc.contest.adminGetContestParticipants({ contestId })
    │
    └──> 3. Clicks "Inspect" on any student / submission
           │
           ▼
     [ <StudentSubmissionsDrawer /> ]
           │
           ├──> trpc.contest.adminGetStudentSubmissions({ contestId, userId })
           │      └── Returns student info, coding problem list with best scores,
           │          and full attempts with code + diagnostic logs
           ▼
     [ Monaco Editor (Source Code) + Expandable Test Case Diffs (Input/Expected/Stdout/Stderr) ]
```

- **Entry Points**:
  - Global Feed: [`src/app/dashboard/contests/submissions/page.tsx`](file:///d:/kernel2/src/app/dashboard/contests/submissions/page.tsx)
  - Contest Tabs: [`src/app/dashboard/contests/[id]/page.tsx`](file:///d:/kernel2/src/app/dashboard/contests/[id]/page.tsx)
  - Student Drawer: [`src/components/contests/student-submissions-drawer.tsx`](file:///d:/kernel2/src/components/contests/student-submissions-drawer.tsx)
- **Functions Called**:
  - `trpc.contest.adminGetSubmissions`: bi-directional cursor querying on `submission` with indexed `contest_id` and `created_at`.
  - `trpc.contest.adminGetStudentSubmissions`: loads coding attempts, best scores, and full test case diagnostics for a single student.
  - `trpc.contest.adminGetContestParticipants`: loads participants list with submission counts.
- **Security Guard**: All 3 queries are guarded by `adminProcedure`. Student response in `submitCode` redacts hidden test case details.

---

## 9. Post-Contest Student Submissions Review & Result Visibility Flow

```
[ Student Finishes Contest Attempt ]
                 │
                 ▼
[ Redirect to /contest/[code]/results ]
                 │
                 ├── Calls trpc.contest.getResults({ contestId })
                 │
        ┌────────┴──────────────────────────┐
        │                                   │
        ▼ (isEnded === false)               ▼ (isEnded === true)
[ Holding State Screen ]           [ Official Results Screen ]
├── "Contest Finished"             ├── Final Score & Rank Cards
├── Attempted: X / Y questions     ├── Leaderboard (Top 10 + You)
├── Scores & Ranks locked          └── Button: "Review My Submissions"
└── Unlock Notice: at endTime                       │
                                                    ▼
                                    [ Navigates to /contest/[code]/review ]
                                                    │
                                                    ├── Calls trpc.contest.getStudentReview({ contestId })
                                                    │     ├── Verifies NOW() >= contest.endTime
                                                    │     └── Returns questions with final submitted code,
                                                    │         correct answers, & test diagnostics
                                                    ▼
                                    [ Fullscreen Review Workspace ]
                                    ├── Question Navigator (🟢 Correct, 🟡 Partial, 🔴 Incorrect, ⚪ Unattempted)
                                    ├── Left: Description, Marks Awarded / Max Marks, Hint
                                    └── Right:
                                          ├── MCQ: Options + "Your Answer" + "Correct Answer"
                                          ├── Text: Student Answer vs Expected
                                          └── Code: Read-only Monaco Editor (Final Code)
                                                ├── Best Score vs Final Attempt Reconciliation Banner
                                                ├── Sample Test Cases (all displayed)
                                                └── Hidden Test Cases (revealed ONLY if failed)
```

- **Entry Points**:
  - Results Page: [`src/app/contest/[code]/results/page.tsx`](file:///d:/kernel2/src/app/contest/[code]/results/page.tsx)
  - Review Workspace: [`src/app/contest/[code]/review/page.tsx`](file:///d:/kernel2/src/app/contest/[code]/review/page.tsx)
- **Functions Called**:
  - `trpc.contest.getResults`: hides scores/ranks if `NOW() < contest.endTime`; shows full score and rank once contest has ended.
  - `trpc.contest.getStudentReview`: returns detailed breakdown of student's final submission vs correct answers for all questions.
- **Security Guard**: Enforces `new Date() >= new Date(contest.endTime)` in both `getResults` (for score/rank data) and `getStudentReview` (for correct answers). Hidden test cases that passed are never revealed.

---

## 10. Student Contest Hub & Participation Review Flow

```
[ Student Navigates to /contest ]
                 │
                 ├── Calls trpc.contest.getStudentPastContests()
                 │     ├── Queries contest_participation JOIN contest (for ctx.user.id)
                 │     ├── Calculates DB time-locks: NOW() >= contest.endTime & NOW() < contest.endTime
                 │     └── Returns:
                 │           - Concluded: Score, Rank, canReview: true
                 │           - Results Pending: Score: null, Rank: null, isResultsPending: true
                 │           - In Progress: startedAt, isInProgress: true
                 │
        ┌────────┴──────────────────────────────────────────┐
        │                                                   │
        ▼ (Click "Enter Contest Code")                      ▼ (Browse Past Participations)
[ Base UI Dialog Modal ]                            [ Past Contests Cards Grid ]
├── Input: Contest Code (autofocus, uppercase)      ├── Concluded:
├── Action: "Proceed to Contest"                    │     ├── "Scorecard" -> /contest/[code]/results
└── Router: /contest/[code]                         │     └── "Review" -> /contest/[code]/review
        │                                           ├── Results Pending:
        ▼                                           │     └── "View Holding Status" -> /contest/[code]/results
[ Contest Cover Page /contest/[code] ]              └── In Progress:
├── Verifies contest existence & start time               └── "Resume Attempt" -> /contest/[code]/attempt
└── "Start Attempt" -> /contest/[code]/attempt
```

- **Entry Points**:
  - Hub Page: [`src/app/contest/page.tsx`](file:///d:/kernel2/src/app/contest/page.tsx)
- **Functions Called**:
  - `trpc.contest.getStudentPastContests`: Enforces authoritative DB time-lock (`NOW() >= contest.endTime`) to sanitize scores and prevent score leaks during live contests while presenting a comprehensive dashboard of completed and ongoing exams.



