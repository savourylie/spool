---
description: Implement all pending tickets from the ticket tracker, working through them one by one with QA review.
allowed-tools: Read, Write, Edit, Grep, Glob, Bash, TodoList, Skill
---

**Argument:** `$ARGUMENTS`

You are a senior full-stack developer working through a backlog of implementation tickets. Follow this workflow precisely. Do not skip steps.

If an argument was provided (e.g., `TICKET-001`), implement ONLY that specific ticket and stop after Phase 6 (do not loop). If no argument was provided, implement all pending tickets as described below.

## Phase 1: Understand the Project

1. Read `docs/PRDv0.md` thoroughly. Internalize the product requirements, user stories, acceptance criteria, and scope.
2. Read `docs/DESIGN.md` thoroughly. Understand the architecture, data models, API contracts, tech stack choices, and any design decisions or constraints.
3. Briefly summarize (to yourself) the key requirements and architectural decisions before moving on. This is your mental model for all implementation work.

## Phase 2: Pick the Next Ticket

1. Read `docs/tickets/INDEX.md` to see the current status of all tickets.
2. **If a specific ticket was provided as an argument**, select that ticket regardless of ordering. If it is already marked as done, inform the user and stop.
   **Otherwise**, select the next ticket that is **not yet marked as done/complete**. Respect any ordering or priority indicated in the index. If tickets have dependencies, resolve dependencies first.
3. Read the full ticket file (e.g., `docs/tickets/TICKET-001.md`) for the selected ticket.
4. Before writing any code, briefly state:
   - What you're implementing
   - Which files you expect to create or modify
   - Any edge cases or risks you see

## Phase 3: Implement the Ticket

1. Implement the ticket fully, following the design in `DESIGN.md` and the requirements in the ticket.
2. Write clean, well-structured code. Follow existing project conventions (naming, file structure, patterns).
3. Include appropriate error handling, input validation, and edge case coverage.
4. If the ticket specifies tests, write them. If it doesn't but the project has a test suite, add tests for your changes anyway.
5. Make sure any new files are properly exported/imported and integrated with the rest of the codebase.

## Phase 4: Code Review

### 4a: Build Check

Run lint, type-check, and build commands from `package.json` (e.g., `npm run lint`, `npm run build`). Fix any errors until the build is clean.

### 4b: Automated Code Review

Invoke the `/code-review` skill using the `Skill` tool to review all uncommitted changes against the ticket requirements:

```
skill: "code-review"
```

### 4c: Fix and Re-review

If the code review finds any issues:
1. Fix them immediately.
2. Re-run the build check (4a) until clean.
3. Re-invoke `/code-review` (4b) to verify fixes.
4. Repeat until both build and code review are clean.

## Phase 5: Commit

1. Stage all changed files relevant to this ticket.
2. Write a clear commit message following this format:
   ```
   feat(TICKET-ID): Short summary of what was implemented

   - Bullet points describing key changes
   - Reference the ticket ID
   ```
   Use conventional commit prefixes: `feat`, `fix`, `refactor`, `test`, `docs`, `chore` as appropriate.
3. Commit the changes.

## Phase 6: Update Ticket Status

Invoke the `/update` skill using the `Skill` tool to mark the ticket as done:

```
skill: "update", args: "TICKET-NNN done"
```

Replace `TICKET-NNN` with the actual ticket ID (e.g., `TICKET-005 done`).

The `/update` skill handles everything: updating the ticket file status, cascading dependency changes, refreshing INDEX.md (tables, counts, graph), verification, and its own commit. Do **NOT** manually edit ticket files or `docs/tickets/INDEX.md`.

## Phase 7: Loop

**If a specific ticket was provided as an argument**, stop here. That ticket is done.

**Otherwise**, go back to **Phase 2**. Pick the next incomplete ticket and repeat the entire cycle.

Continue until ALL tickets in `docs/tickets/INDEX.md` are marked as done.

When all tickets are complete, provide a final summary:
- How many tickets were implemented
- Any notable decisions or deviations from the original design
- Any remaining concerns, tech debt, or follow-up items worth noting
