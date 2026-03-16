---
description: Implement all pending tickets from the ticket tracker, working through them one by one with QA review.
allowed-tools: Read, Write, Edit, Grep, Glob, Bash, TodoList
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

## Phase 4: QA Review (Self-Review as Senior QA)

Switch your mindset entirely. You are now a **senior QA engineer** reviewing someone else's work. Be critical and thorough.

1. **Correctness**: Re-read the ticket requirements. Does the implementation satisfy every acceptance criterion? Check line by line.
2. **Code quality**: Are there any code smells, duplication, or violations of the project's conventions?
3. **Edge cases**: What happens with empty inputs, nulls, boundary values, concurrent access, or malformed data?
4. **Integration**: Does this change break anything else? Check imports, type contracts, and interfaces with adjacent code.
5. **Tests**: Do the tests actually verify the right behavior? Are there missing test cases?
6. **Build check**: If there is a build or lint command available (check `package.json`, `Makefile`, etc.), run it and fix any errors.

If you find ANY issues during QA:
- Fix them immediately.
- Re-run the QA checklist on the fixed code.
- Repeat until the implementation cleanly passes all checks.

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

1. Update `docs/tickets/INDEX.md` to mark this ticket as **done** (or whatever status convention the file uses).
2. Commit this status update separately:
   ```
   docs: mark TICKET-ID as done
   ```

## Phase 7: Loop

**If a specific ticket was provided as an argument**, stop here. That ticket is done.

**Otherwise**, go back to **Phase 2**. Pick the next incomplete ticket and repeat the entire cycle.

Continue until ALL tickets in `docs/tickets/INDEX.md` are marked as done.

When all tickets are complete, provide a final summary:
- How many tickets were implemented
- Any notable decisions or deviations from the original design
- Any remaining concerns, tech debt, or follow-up items worth noting
