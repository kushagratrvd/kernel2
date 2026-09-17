# Rollback Safety Net

> Safety net for tracking stable commit checkpoints, critical file rollback points, and post-revert verification steps.

---

## 1. Commit Checkpoints

| Commit Hash | Commit Message | Verified State |
| :--- | :--- | :--- |
| `b42d601` | `feat: admin direct question approval with immutable snapshot minting and assignment cancel-and-create pattern` | Admin direct approval live; immutable version snapshot minting; 0 tsc errors. |
| `50582fc` | `feat: restrict contests access and visibility exclusively to admin` | Contests completely restricted to Admin. `pnpm tsc` clean. |
| `251ef29` | `refactor: extract QuestionStatusBadge and ReviewDiscussionThread into reusable components` | Shared components extracted with zero styling drift. |
| `1f84975` | `feat: enhance reviewer desk and question studio with table layout, accurate review history status, and chat thread` | Table layouts active; accurate "Changes Requested" badge; modal discussion thread. |
| `ff479af` | `feat: AI question generator with Gemini and Groq, on-demand Codebox test runs, and markdown image support` | AI Studio and Codebox integration. |

---

## 2. Rollback Recipes

### Recipe A: Revert Contest Visibility Restrictions
If contest restrictions need to be backed out to allow creators to access contests again:
```bash
# Revert commit 50582fc
git revert --no-edit 50582fc

# Files restored by revert:
# - src/server/trpc/routers/contest.ts (restores creatorProcedure on contest mutations)
# - src/app/dashboard/page.tsx (restores contests query for all staff)
# - src/app/dashboard/contests/layout.tsx (removes admin guard)
# - src/app/dashboard/admin/users/page.tsx (restores role description)

# Verify build
pnpm exec tsc --noEmit
```

### Recipe B: Revert Shared Components Refactor
If the shared components introduce unexpected regressions in production:
```bash
# Revert commit 251ef29
git revert --no-edit 251ef29

# Verify build
pnpm exec tsc --noEmit
```

### Recipe C: Revert Admin Direct Question Approval
If direct approval needs to be backed out:
```bash
# Revert the direct approval commit
git revert --no-edit HEAD

# Files restored by revert:
# - src/server/trpc/routers/question-bank.ts (removes directApproveDraft and reverts validation)
# - src/lib/get-user-roles.ts (removes shared helper)
# - src/app/dashboard/questions/question-detail-modal.tsx (removes direct approve button & dialog)
# - src/app/dashboard/questions/page.tsx (removes direct approve table action & dialog)
# - src/components/questions/review-discussion-thread.tsx (removes admin approve banner)
# - src/app/dashboard/page.tsx (restores inline getUserRoles)
# - src/app/dashboard/contests/layout.tsx (restores inline getUserRoles)

# Verify build
pnpm exec tsc --noEmit
```

---

## 3. Post-Revert Verification Checklist

After performing any rollback:
1. Run `pnpm exec tsc --noEmit` and confirm **0 errors**.
2. Run `git status` to ensure working tree is clean.
3. Verify `/dashboard`, `/dashboard/questions`, and `/dashboard/reviews` load without React hydration or runtime exceptions.
