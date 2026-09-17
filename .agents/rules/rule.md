---
trigger: always_on
---

## AI Collaboration Rules

### Core Documentation Files (maintain at project root)

**handover.md** — Living session continuity file. Write context incrementally: what is fully done, what is currently in progress. This is not a dump of everything — it is a precise snapshot of where things stand _right now_. Read this at the start of every session. Append a 5-line summary at the start of every session, at the top of the file, and the previous sessions come later: what was done, what's left, what to watch out for. Never start a session cold without reading this first.

**decisions.md** — Rationale log for every meaningful decision made while changing the codebase. For every significant choice — which library, which pattern, which tradeoff — log: the date, the decision made, the alternatives considered, and the concrete reason this option was chosen over the others. Format: `[date] Decision: X over Y because Z`. This file answers "why" when the code only shows "what". Six months from now, this file is the only thing that prevents re-litigating settled arguments.

**flow.md** — Execution flow map. Document how execution actually travels across the codebase: which files call which functions, in what order, and through which modules. Keep this updated whenever the flow changes. Whenever a change is being made, explicitly note which part of the documented flow is being modified. Bugs live in the gaps between files — this map is how those gaps stay visible.

**architecture.md** — High-level system map. Document all major modules, services, APIs, and how data moves between them. This is not implementation detail — it is the shape of the system at a glance, so the AI does not have to re-derive it from scratch every session. Update this whenever the structural shape of the system changes. Without this map, every session begins by guessing the terrain.

**constraints.md** — Hard boundaries the AI must never violate. Explicitly list: which modules or files must not be touched, which patterns must always be used, which dependencies must never be added without asking, and any other non-negotiable rules. If this file does not exist yet, create it and ask the user what is off-limits before proceeding with any work. "Allow" means scoped permission, not unlimited permission.

**bug.md / feature.md** — Full trace file per bug or feature. For every bug fix or feature, maintain one file that tracks it completely from start to finish: how it was discovered or scoped, every approach that was tried, what worked and what didn't, and how the final result was verified. Anyone — human or AI — should be able to read this file cold and know exactly how to pick up where it left off.

**test-checklist.md** — Verification checklist. A concrete, specific list of commands to run and outputs to verify before any change is considered done. Not a vibe check — actual commands, actual expected outputs.

**rollback.md** — Safety net for risky changes. For any large or high-risk edit, document before making the change: which commit or state to revert to, which files to restore, and what to re-check after reverting. Update this proactively before touching anything risky. Confidence to make bigger changes comes from knowing exactly how to undo them.

**plans.md** — Incremental implementation plan log. Here's just copy paste your Implementation plans, with executed or cancelled tag.

### Code Comments

- Always add inline comments on non-obvious logic — not restating what the code does, but explaining intent: what this block is for, what calls into it, and what assumes it exists downstream.

### Before Implementing Anything

- Ask before if there are multiple concerns in a single edit. Smaller, scoped changes are easier to verify and mistakes stay traceable to a single step.
- Read constraints.md before touching any file.

### Reviewing Changes

- Show the actual diff. Summaries can be wrong or incomplete. Diffs cannot lie about what actually changed.
- Never mark a change as done without running the test checklist.

### Version Tracking

- When appending to decisions.md, note which AI model or version made the decision. Behavior shifts between model versions — knowing which one reasoned through a given change matters when debugging it later.
