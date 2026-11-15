# Verification & Test Checklist

> Concrete, runnable checklist to verify system correctness before marking any task as done.
> Every entry specifies the exact command, expected exit code, and expected output criteria.

---

## 1. Type Safety & TypeScript Build Verification

- **Command**:
  ```bash
  pnpm exec tsc --noEmit
  ```
- **Expected Exit Code**: `0`
- **Expected Output**:
  - Empty stdout/stderr (Zero compiler errors).
  - No missing imports, type mismatches, or invalid JSX properties.

---

## 2. Access Control & Role Boundary Tests

### Test 2.1: Non-Admin Contest API Access
- **Target**: `trpc.contest.listAll` and `trpc.contest.create`
- **Test User Roles**: `creator`, `reviewer`, `student`
- **Expected Result**:
  - TRPC throws `TRPCError` with code `FORBIDDEN` and message `"You must be an admin to perform this action"`.

### Test 2.2: Contest Route Guard Redirect
- **Target Route**: `/dashboard/contests/new` or `/dashboard/contests/[id]`
- **Test User Roles**: User with only `creator` or `reviewer` role.
- **Expected Result**:
  - Handled by `ContestsAdminLayout`: User is immediately replaced/redirected to `/dashboard`.
  - No flash of contest creation or management UI.

### Test 2.3: Dashboard UI Role Visibility
- **Creator Login**:
  - Visible: Question Creator Studio table, "My Working Drafts" count, "Verified Questions" count, "+ New Question" button, "Generate with AI" button.
  - Hidden: "Active Contests" card, "Create Contest" button, "Contests Overview" table.
- **Reviewer Login**:
  - Visible: Reviewer Desk table, "Pending Reviews" queue count.
  - Hidden: "Active Contests" card, "Create Contest" button, "Contests Overview" table.
- **Admin Login**:
  - Visible: "Admin & Operations Center", "Users & Roles", "Active Contests" card, "Create Contest" button, "Contests Overview" table with "+ Add Contest" and "Manage" actions.

---

## 7. Admin Code Submissions Monitoring Verification

### Test 7.1: Type Safety & Compilation
- **Command**:
  ```bash
  pnpm exec tsc --noEmit
  ```
- **Expected Exit Code**: `0`
- **Expected Output**: Zero compiler errors across all new admin endpoints and UI components.

### Test 7.2: Submission Schema `contest_id` Constraint
- **Target**: `submission` table in Drizzle schema.
- **Criteria**:
  - `contestId` is defined on `submission` with a foreign key to `contest.id` (cascade on delete).
  - Both `submitCode` and `submitMcqOrTextAnswer` pass `contestId` into `ctx.db.insert(submission)`.
  - Indexes: `submission_contest_id_idx` and `submission_contest_created_at_idx`.

### Test 7.3: Diagnostic Redaction for Students
- **Target**: `trpc.contest.submitCode`
- **Criteria**:
  - Full diagnostic data (all test cases including hidden input/expected) is saved in database `executionResult`.
  - Return payload to student strips hidden test case `input`, `expectedOutput`, `stdout`, and `stderr` (only `isSample === true` cases retain stdout/stderr).

### Test 7.4: Admin Live Submissions Query & Access Guard
- **Target**: `trpc.contest.adminGetSubmissions`
- **Criteria**:
  - Guarded by `adminProcedure` (rejects non-admins with FORBIDDEN).
  - Code submissions only (`languageId IS NOT NULL`).
  - Supports `afterCursor` for fetching only new submissions and `beforeCursor` for paginating into older submissions.

### Test 7.5: Student Inspection Drawer & UI
- **Target**: `<StudentSubmissionsDrawer />`
- **Criteria**:
  - Problem switcher renders only `questionType = 'code'` problems.
  - Displays chronological attempts, Monaco code viewer in read-only mode, and diagnostic diffs for failed test cases.


### Test 3.1: Question Creation to Submission
1. Creator creates question in Question Studio.
   - **Verification**: Question appears with `Draft` badge (`QuestionStatusBadge`).
2. Creator clicks "Submit to Reviewer" and selects reviewer.
   - **Verification**:
     - `questionVersion` row inserted with version `1`.
     - Badge updates to `Submitted` (`SUBMITTED_FOR_REVIEW`).
     - Assignment appears in Reviewer Desk queue with `Pending Pickup`.

### Test 3.1b: Question Draft Editing
1. Creator clicks "Edit Draft" on a question in `DRAFT` or `CHANGES_REQUESTED` status.
   - **Verification**:
     - Modal opens with title "Edit Question Draft".
     - All inputs (title, description, hint, score, options/test cases, taxonomy) prefill correctly from `currentDraft`.
     - Question Type is displayed in read-only badge to prevent accidental schema mutation.
2. Creator updates title, description, or test cases, and clicks "Save Changes".
   - **Verification**:
     - `trpc.questionBank.updateDraft` executes successfully.
     - Modal closes, toast "Draft updated successfully!" appears.
     - Table updates immediately with new title, description, and score.
     - Question status remains `DRAFT` (or `CHANGES_REQUESTED`) until explicitly submitted.

### Test 3.2: Reviewer Discussion & "Changes Requested"
1. Reviewer clicks "Pick Up" -> status becomes `In Review` (`IN_REVIEW`).
2. Reviewer opens review modal and sends feedback comment.
   - **Verification**: Message immediately appears in `<ReviewDiscussionThread />`.
3. Reviewer clicks "Request Changes" with revision note.
   - **Verification**:
     - In Review History, status displays amber **"Changes Requested"** badge with pulsating dot.
     - In Creator's studio, question status displays **"Changes Requested"**.
     - Creator modal shows amber guidance banner with "Re-submit to Reviewer" button.

### Test 3.3: Approval Workflow
1. Reviewer clicks "Approve".
   - **Verification**:
     - Question status updates to **"Approved"** (green badge).
     - Question is now queryable by Admin's `QuestionPickerDialog` for contests.

### Test 3.4: Admin Direct Approval Workflow
1. Admin opens `/dashboard/questions`.
2. Locates a question in `DRAFT`, `CHANGES_REQUESTED`, `SUBMITTED_FOR_REVIEW`, or `UNDER_REVIEW`.
   - **Verification**: "Approve to Bank" button appears in the table action column.
3. Clicks row to open Question Detail Modal.
   - **Verification**:
     - Header displays "Approve to Question Bank" button with green styling.
     - Review thread displays "Admin Direct Approval Available" banner with action button.
4. Clicks "Approve to Question Bank".
   - **Verification**: Confirmation dialog appears stating *"This will approve the current draft and create an immutable question version. Any active peer-review assignment will be cancelled."*
5. Enters optional note and confirms.
   - **Verification**:
     - `directApproveDraft` succeeds.
     - `questionVersion` snapshot is minted.
     - Any previous active assignment is set to `CANCELLED`.
     - A new `COMPLETED` assignment is created for the Admin with the verification comment.
     - Question status transitions immediately to **Approved** (`APPROVED`).
     - Question is immediately selectable in Contest Editor's "Add from Question Bank".

### Test 3.5: Admin Universal Rejection Workflow
1. Admin opens `/dashboard/questions` and locates any question in active status (`DRAFT`, `CHANGES_REQUESTED`, `SUBMITTED_FOR_REVIEW`, `UNDER_REVIEW`, or `APPROVED`).
2. Clicks "Reject" in table or Question Detail Modal.
   - **Verification**: Rejection dialog opens with required "Reason for Rejection" textarea and "Confirm Rejection" button disabled if empty.
3. Enters rejection reason and confirms.
   - **Verification**:
     - Status updates immediately to **"Rejected"** (red badge).
     - Any active peer assignment transitions to `CANCELLED`.
     - If version snapshot exists, a completed admin assignment is inserted with `[REJECTED BY ADMIN]: <reason>` in discussion thread.
     - Question ceases to appear in Contest Question Picker (`listQuestionBank`).
     - Audit log records `ADMIN_REJECTED`.

### Test 3.6: Admin Restore to Draft Workflow
1. Admin filters by `REJECTED` in Question Studio table.
2. Clicks "Restore to Draft" in table or Detail Modal.
3. Optional guidance note is entered and confirmed.
   - **Verification**:
     - Status updates to **"Draft"** (`DRAFT`).
     - Question author can now edit draft problem statement, test cases, and options in Question Studio.
     - "Submit to Reviewer" button becomes available again for author.
     - Audit log records `ADMIN_RESTORED_TO_DRAFT`.

### Test 3.7: Admin Archive & Unarchive Workflow
1. Admin locates an `APPROVED` question.
2. Clicks "Archive" and confirms.
   - **Verification**:
     - Status updates to **"Archived"** (`ARCHIVED` badge).
     - Question is removed from Question Bank contest picker.
     - Any existing contests using this question version remain unaffected and operational.
3. Admin clicks "Unarchive to Bank" on the archived question.
   - **Verification**:
     - Status restores directly to **"Approved"** (`APPROVED`).
     - Question immediately reappears in Question Bank contest picker without requiring re-review.
     - Audit log records `QUESTION_UNARCHIVED`.

---

## 4. Code Execution & Codebox Sandbox Tests

- **Target**: Code question test runner
- **Action**: Run code against sample inputs in Question Studio or Contest Attempt.
- **Expected Result**:
  - Codebox returns status `Accepted` for correct outputs, or `Wrong Answer` / `Compile Error` / `Time Limit Exceeded` when thresholds are exceeded.

---

## 5. Admin Code Submissions Live Monitoring & Inspection Checklist

### 5.1 Type & Schema Verification
- **Command**: `pnpm exec tsc --noEmit`
- **Expected Output**: Exit code `0` with zero TypeScript errors.

### 5.2 Global Live Submissions Feed (`/dashboard/contests/submissions`)
- **Action**: Navigate to `/dashboard/contests/submissions` as an Admin.
- **Expected Outputs**:
  - Header displays "Code Submissions Live Feed" with an active live pulse badge.
  - Contest dropdown, Status dropdown (All, Accepted, Wrong Answer, etc.), and Student Search input are operational.
  - Submissions table renders with columns: Time, Student, Contest, Problem, Language, Status, Passed, Score, Execution.
  - Every 4 seconds, live polling triggers `afterCursor` query without full page refresh or scroll jumping.
  - Clicking "View Student" opens the `<StudentSubmissionsDrawer />` for that student.

### 5.3 Per-Contest Submissions & Participants Tabs (`/dashboard/contests/[id]`)
- **Action**: Open `/dashboard/contests/[id]` as an Admin.
- **Expected Outputs**:
  - Tab bar renders: "Questions & Settings", "Live Submissions", "Participants".
  - Switching to "Live Submissions" loads only submissions for this contest with 4s auto-polling.
  - Switching to "Participants" displays all registered students with solved coding problem counts, total submissions, and rank.
  - Clicking "Inspect Submissions" on any participant row opens the `<StudentSubmissionsDrawer />`.

### 5.4 Student Submissions Drawer (`<StudentSubmissionsDrawer />`)
- **Action**: Open the drawer for a student with coding submissions.
- **Expected Outputs**:
  - Student name, email, rank, and score are displayed in the header.
  - Coding problem pill selector lists all coding problems in the contest with best score badges.
  - Selecting a problem displays chronological attempts (Attempt #1, Attempt #2, ...).
  - Clicking "View Code" opens the read-only Monaco editor syntax-highlighted in the submitted language.
  - For failed attempts, expandable test case cards display input, expected output, and actual student stdout/stderr.
  - For passed test cases, simple green badge displays without polluting diff view.

### 5.5 Student API Response Sanitization & Examination Security
- **Action**: Inspect Network tab during a student code submission in `/contest/[code]`.
- **Expected Outputs**:
  - `submission.executionResult` in DB contains full test case inputs, expected outputs, stdout, and stderr for all test cases.
  - The client response returned to the student runner redacts private/hidden test case inputs and expected outputs (e.g. `[Hidden Test Case]`).

---

## 6. Post-Contest Student Submissions Review & Result Visibility Checklist

### 6.1 Type & Schema Verification
- **Command**: `pnpm exec tsc --noEmit`
- **Expected Output**: Exit code `0` with zero TypeScript errors.

### 6.2 Active Contest Holding State (`NOW() < contest.endTime`)
- **Action**: Complete a contest attempt before the contest end time and view `/contest/[code]/results`.
- **Expected Outputs**:
  - Displays "Contest Completed — Results Pending".
  - Shows "Questions Attempted: X / Y".
  - Scores, ranks, and leaderboard are NOT rendered.
  - "Review My Submissions" button is hidden.
  - Attempting to query `trpc.contest.getStudentReview` directly returns `FORBIDDEN` ("Solutions and review will be available after the contest ends at [endTime]").

### 6.3 Concluded Contest Results (`NOW() >= contest.endTime`)
- **Action**: Open `/contest/[code]/results` after the contest has ended.
- **Expected Outputs**:
  - Congratulations card displays final score, total score, and official rank.
  - Leaderboard is populated with top participants and "You" indicator.
  - Prominent "Review My Submissions" button is visible and active.

### 6.4 Fullscreen Review Workspace (`/contest/[code]/review`)
- **Action**: Click "Review My Submissions" to open `/contest/[code]/review`.
- **Expected Outputs**:
  - Header displays contest title, "Review Mode" badge, total score, and theme toggle.
  - Question Navigator displays color-coded pills (🟢 Correct, 🟡 Partial, 🔴 Incorrect, ⚪ Unattempted).
  - Left panel shows question title, difficulty, marks awarded vs max marks, markdown problem description, and optional hint.
  - **MCQ Questions**: Shows all options with student's chosen option tagged ("Your Answer") and correct option highlighted in green ("Correct Answer").
  - **Text Questions**: Shows student's submitted text vs expected answer.
  - **Coding Questions**:
    - Displays student's strict final submitted code in read-only Monaco editor.
    - If final attempt score != best score, displays reconciliation banner: *"Final Attempt (Score: X/max) — Best Score Counted: Y/max"*.
    - Sample test cases show input, expected output, and stdout.
    - Hidden test cases: Passed hidden test cases show green "Passed (Private)" badge without input/output leak. Failed hidden test cases show input, expected output, and stdout/stderr so the student can diagnose their error.
  - **Unattempted Questions**: Clearly displays "You did not attempt this question", 0 marks awarded, while revealing the correct answer / starter code.

### 6.5 Student Contest Hub & Earlier Participated Contests Verification
- **Target**: `/contest` (Student Landing Page) & `trpc.contest.getStudentPastContests`
- **Actions & Expected Outputs**:
  1. **Enter Contest Code Modal**:
     - Clicking "Enter Contest Code" opens Base UI `<Dialog>` modal.
     - Input automatically focuses with monospace uppercase styling.
     - Submitting valid code (e.g. `KRN101`) navigates student to `/contest/KRN101`.
  2. **Past Contests Cards Grid**:
     - Concluded contests (`NOW() >= endTime`): Displays score and rank badges, with direct "Scorecard" (`/results`) and "Review" (`/review`) buttons.
     - Live submitted contests (`NOW() < endTime`): Displays "Results Pending" badge with score/rank strictly masked; clicking "View Holding Status" directs to `/results` holding screen.
     - In-progress contests: Displays "In Progress" badge with a direct "Resume Attempt" (`/attempt`) button.
  3. **Empty State**:
     - For students with 0 past participations, displays a friendly empty state card with an "Enter Contest Code" button.

---

## 8. External REST API Integration (CareerForge <-> Kernel)

### Test 8.1: API Key Guard & Unauthorized Access
- **Command**:
  ```bash
  curl -i http://localhost:3000/api/v1/contests
  ```
- **Expected Exit Code**: `0`
- **Expected HTTP Status**: `401 Unauthorized`
- **Expected Output JSON**: `{"success":false,"error":"Unauthorized: Invalid or missing X-Kernel-Api-Key header"}`

### Test 8.2: Contests Feed (`GET /api/v1/contests`)
- **Command**:
  ```bash
  curl -s -H "X-Kernel-Api-Key: kernel_secret_key_2026" http://localhost:3000/api/v1/contests
  ```
- **Expected Exit Code**: `0`
- **Expected HTTP Status**: `200 OK`
- **Expected Response**: JSON object with `success: true`, `count >= 1`, and array of contest summaries with `status` ("LIVE", "CONCLUDED", "UPCOMING").

### Test 8.3: Contest Leaderboard Time-Lock (`GET /api/v1/contests/:code/leaderboard`)
- **Action (Live Contest)**: Call `/api/v1/contests/TODAY/leaderboard` when contest `TODAY` is live (`NOW() < endTime`).
- **Expected Response**:
  ```json
  {
    "success": true,
    "timeLocked": true,
    "message": "Contest is still ongoing. The official leaderboard will be released once the contest concludes at ...",
    "leaderboard": []
  }
  ```
- **Action (Concluded Contest)**: Call `/api/v1/contests/KRN101/leaderboard` for concluded contest `KRN101`.
- **Expected Response**:
  - `success: true`
  - `timeLocked: false`
  - `totalParticipants >= 1`
  - `leaderboard`: Array of student records sorted by `rank`, with `studentName`, `studentEmail`, `score`, `maxScore`, and `durationMinutes`.

### Test 8.4: Student Scorecards & Contests History (`GET /api/v1/students/:email/contests`)
- **Action (Active Student)**: Call `/api/v1/students/student@kernel.dev/contests`.
- **Expected Response**:
  - `success: true`, `found: true`.
  - Concluded contests return `status: "CONCLUDED"`, with real `score` and `rank`.
  - Active contests return `status: "RESULTS_PENDING"`, with `score: null` and `rank: null`.
- **Action (Non-existent Student)**: Call `/api/v1/students/unknown@careerforge.com/contests`.
- **Expected Response**:
  - `success: true`, `found: false`, `student: null`, `participations: []` (clean HTTP 200).


