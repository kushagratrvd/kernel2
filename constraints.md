# AI Engineering Constraints & Operational Boundaries

These are non-negotiable boundaries and rules for the AI coding assistant (Antigravity):

## 1. Architectural & File Boundaries
- **No Direct Schema Migration Hacks**: Do not edit database tables or execute ad-hoc SQL migrations without verifying against existing Drizzle schema definitions (`src/server/db/*`).
- **No Unauthorized Dependency Additions**: Never run `pnpm add` or install new npm packages/libraries without explicit confirmation from the user.
- **Preserve Existing Styling & Design Systems**:
  - Do not redesign or alter visual styles, color palettes, spacing, typography, or UI tokens unless explicitly requested.
  - When creating or extracting reusable components, preserve exact existing classes, layout structures, and tokens.
- **Protected Files & Modules**:
  - Do not touch `.env` or delete existing migration files in `drizzle/`.
  - Do not modify student contest runner execution mechanics (`/contest/[code]`) without explicit task scope.

## 2. Coding & Implementation Patterns
- **Full Type Checking Required**: Always verify TypeScript compilation (`pnpm exec tsc --noEmit`) before concluding any task.
- **No Mock or Placeholder Data**: Use active database models and TRPC routes; avoid introducing hardcoded fake datasets when backend endpoints exist.
- **Atomic, Traceable Changes**: Keep edits scoped and verify diffs so that changes are clean and easily auditable.

## 3. Role & Permission Invariants
- **Contest Access Restriction**: Contests are an Admin-only responsibility. Creators and Reviewers must never see contests or be granted access to `/dashboard/contests/*`.
