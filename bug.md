# Bug Trace: Sample Test Cases Marked as "Wrong Answer" on Review Workspace

## Discovery & Scope
- **Reported**: Student submissions in `/contest/[code]/review` showed `WRONG ANSWER` on all sample test cases even when the student's submission scored 100/100 and was marked "Accepted".
- **Screenshot Evidence**: `media_1794689469275_78f7b33d.png` showed sample test case 1 (Input: `Chai`, Expected: `Hello, Chai!`) and test case 2 (Input: `Kernel`, Expected: `Hello, Kernel!`) with red badges `WRONG ANSWER` and missing actual student output.

## Root Cause Analysis
1. In `src/server/trpc/routers/contest.ts`, `submitCode` persists test case execution records in `submission.executionResult` with the shape:
   ```ts
   const fullExecutionResult = {
     passedCount,
     totalCount: allTestCases.length,
     details: results.map((r) => ({ ... })),
   };
   ```
2. However, in `getStudentReview` (line 829), the code checked:
   ```ts
   if (executionResult && Array.isArray(executionResult.testCases)) { ... }
   ```
   Because the property was saved as `details` (not `testCases`), `Array.isArray(executionResult.testCases)` was `false`.
3. Consequently, the procedure fell back to the `else` branch:
   ```ts
   } else {
     const sampleCases = (content.testCases ?? []).filter((tc) => tc.isSample);
     processedTestCases = sampleCases.map((tc, index) => ({
       index: index + 1,
       isSample: true,
       passed: false, // <-- HARDCODED FALSE!
       input: tc.input,
       expectedOutput: tc.expectedOutput,
       stdout: null,
       stderr: null,
     }));
   }
   ```
4. This returned `passed: false` for every sample test case, causing the review workspace to render `WRONG ANSWER` on all test cases.

## Resolution
1. Updated `getStudentReview` in `src/server/trpc/routers/contest.ts`:
   - Inspects `testCaseDetails = Array.isArray(executionResult?.details) ? executionResult.details : Array.isArray(executionResult?.testCases) ? executionResult.testCases : null`.
   - Correctly maps each test case's `passed: Boolean(tc.passed)`.
   - Correctly preserves `stdout`, `stderr`, `time`, `memory`, and `status`.
2. Updated `src/app/contest/[code]/review/page.tsx`:
   - Displays `PASSED` (green) when `isPassed === true`, and `WRONG ANSWER` (rose) when `false`.
   - If question is unattempted, displays `UNATTEMPTED` (neutral zinc) instead of `WRONG ANSWER`.
   - Displays student's actual output (`tc.stdout`) on both passed and failed test cases to provide clear verification against expected stdout.

## Verification
- Run `pnpm exec tsc --noEmit` -> 0 errors.
