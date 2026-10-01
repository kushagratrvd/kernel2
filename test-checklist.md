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

## 3. Question Bank & Reviewer Workflow Tests

### Test 3.1: Question Creation to Submission
1. Creator creates question in Question Studio.
   - **Verification**: Question appears with `Draft` badge (`QuestionStatusBadge`).
2. Creator clicks "Submit to Reviewer" and selects reviewer.
   - **Verification**:
     - `questionVersion` row inserted with version `1`.
     - Badge updates to `Submitted` (`SUBMITTED_FOR_REVIEW`).
     - Assignment appears in Reviewer Desk queue with `Pending Pickup`.

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
