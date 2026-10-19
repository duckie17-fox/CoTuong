---
name: plan-first
description: "Slow planning interview before non-trivial multi-step work: goal, scope, options, risks, phases, definition of done; get approval, then seed Planning with Files. Use on 'lên plan', 'lập kế hoạch', 'suy nghĩ kĩ trước khi làm', 'I need a real plan first'. Not for one-step asks."
allowed-tools: "Read Write Edit Bash Glob Grep"
---

# Plan First

This skill sits one layer above Planning with Files (PwF). PwF is an execution-time
memory — it keeps an agent from forgetting phases and decisions while it is
*already* doing the work. This skill is what happens *before* that: a deliberately
slow interview that turns a vague request into a plan worth trusting, with a real
human sign-off, before any `task_plan.md` gets created.

Skipping straight to PwF for a complex or high-stakes piece of work means the
agent starts executing against its own first guess at the goal, scope, and
approach — nobody reviewed that guess. This skill exists so the guess gets
challenged first.

## When to slow down vs when to skip this

Use this skill for work where being wrong about scope or approach is expensive:
new features, redesigns, anything spanning multiple sessions or multiple people,
anything with a deadline or budget attached. Skip it for quick single-step asks —
if the user just wants one file edited or one question answered, jump straight
to the work (or straight to PwF if it's multi-step but low-stakes and the
approach is obvious).

## Step 1: The interview — go slow, don't fill in blanks yourself

Read `assets/plan-doc-template.md` before starting — that's the exact structure
the plan will end up in, so ask questions in that order.

Ask about, one topic at a time rather than as one giant list:

1. **Goal & timing** — what does "done" look like, and why does this matter now
   rather than later?
2. **Scope** — what's explicitly included, and just as important, what's
   explicitly *not* included (non-goals prevent scope creep later)?
3. **Constraints** — deadline, people/budget available, anything technical or
   organizational that limits the approach?
4. **Options** — is there more than one reasonable way to do this? Even when the
   user already has a favorite, surface at least one alternative and name the
   trade-off — a plan with only one option considered hasn't actually been
   thought through, it's been rationalized.
5. **Phases** — break the work into 3-7 phases. For each, the phase needs a
   concrete "definition of done," not just a to-do list — "write the code" isn't
   a phase boundary, "user can log in end-to-end" is.
6. **Risks & open questions** — what could go wrong, what's still unknown? It's
   fine — better — to leave something marked "chưa rõ" than to quietly guess.
7. **Dependencies & impact** — who/what else does this touch, and what happens
   if this doesn't get done?

If the user answers quickly and thinly, push back gently and ask for the
specific missing piece rather than writing something vague into the plan.
A plan with placeholders where the real answer should be defeats the purpose —
it looks careful without being careful. It's fine for this interview to take
several rounds; that's the point of "suy nghĩ thật kĩ."

## Step 2: Draft, then self-review before showing the user

Fill `assets/plan-doc-template.md` with everything gathered. Before presenting
it, reread it once as if you were a skeptical reviewer seeing it cold, and ask
yourself: what would they challenge first? Is there a phase with a vague
definition of done? A risk that got mentioned in conversation but didn't make
it into the table? An option that's a strawman instead of a real alternative?
Fix what you find before showing a draft — don't make the user do the quality
check you could have done yourself.

## Step 3: Explicit approval before anything is finalized

Show the full draft in the chat (or write it to a file and show a summary — the
user's preference). Ask directly: does this look right, is anything missing,
does any phase need to be split or merged? Do not treat silence or a quick "ok"
after a rushed draft as real approval — if you rushed step 1, say so and ask
again. Iterate until the user actually signs off. This is the plan's one real
gate; once it's approved and handed to PwF, PwF's own job is to track execution
against it, not to re-litigate the plan.

Save the approved plan to `plans/<slug>-plan.md` in the project root (create the
`plans/` folder if it doesn't exist). `<slug>` is a short kebab-case name derived
from the plan title.

## Step 4: Hand off to Planning with Files

Check whether PwF is present: look for `.claude/skills/planning-with-files/` in
the project. If it's missing, tell the user and stop here — point them at
`https://github.com/OthmanAdi/planning-with-files` (or offer to install it if
you have the means to) rather than inventing your own tracking mechanism. Don't
silently fall back to something else; that creates a second, competing
"source of truth" for progress.

If PwF is present, translate the approved plan into its exact file schema —
don't paraphrase loosely, map section to section so nothing gets lost or
duplicated with a different meaning. PwF's own fields were built for coding/
research tasks, not business planning, so not everything in the plan doc has
a clean home there — see the note after the table for the two sections that
don't map anywhere, and should stay in the plan doc only rather than being
forced into a field that means something else:

| Plan section | Goes into | Where |
|---|---|---|
| Mục tiêu (1) | `task_plan.md` | `## Goal` |
| Mục tiêu (1) → first concrete action | `task_plan.md` | `## Next Step` — the actual first action of Phase 1, not a restatement of the goal. This field sits right under Goal and is what every hook injection shows first, so leaving it as placeholder text defeats the point. |
| Giai đoạn (6), first phase | `task_plan.md` | `## Current Phase` → `Phase 1` |
| Giai đoạn (6) | `task_plan.md` | `## Phases` — one `### Phase N: Title` per plan phase, checklist items become the `- [ ]` items, all start at `**Status:** pending` except phase 1 (`in_progress`) |
| Rủi ro & câu hỏi mở (7) | `task_plan.md` | `## Key Questions` |
| Phương án chọn & lý do (5) — the winning option and why, nothing else | `task_plan.md` | `## Decisions Made` table (`Decision \| Rationale`) |
| Phạm vi (2), Ràng buộc (3) | `findings.md` | `## Requirements` |
| Phụ thuộc (8) — only if it changes what Claude should do (e.g. "waiting on X before Phase 2 can start") | `task_plan.md` | `## Notes` |
| — | `progress.md` | new `## Session: [today]` entry, first line: "Plan approved: `plans/<slug>-plan.md`" |

**Don't force these into PwF — leave them in the plan doc only:**
- **Các phương án đã cân nhắc (4), full table** — `findings.md`'s `## Technical Decisions` table is shaped for `Decision | Rationale` (2 columns, decisions already made), not a 3-column options comparison with rejected alternatives. Squeezing the options table in there either loses the pros/cons or duplicates section 5 in a different shape. Instead, add one line under `findings.md`'s `## Resources`: `"Options considered: see plans/<slug>-plan.md §4"` — a pointer, not a copy.
- **Ước tính tác động (9), impact if done vs not done** — there is no field in `task_plan.md`/`findings.md`/`progress.md` for business impact reasoning; that's expected, since PwF tracks execution status, not the business case for doing the work. Leave it in the plan doc. Do not put it in `## Resources` either — that field is specifically for URLs, file paths, and API references, and prose there breaks its purpose for anyone scanning it later.

If the project uses PwF's parallel-plan mode (multiple features/topics tracked
at once — check for an existing `.planning/` directory), run
`./scripts/init-session.sh <slug>` to create an isolated plan folder instead of
writing to the root files directly, then populate that folder's files the same
way. If this is the only active plan in the project, root-level files are fine.

After seeding the files, tell the user plainly: the plan doc is the record of
*why*, PwF's files are now the record of *what's happening* — point them at
`plans/<slug>-plan.md` for the reasoning and `task_plan.md` for live status,
so they don't go looking for the reasoning inside `task_plan.md` later and not
find it.

## Reusing this skill in another project

This skill has no project-specific assumptions — copy the whole
`plan-first/` folder into another project's `.claude/skills/` (or to
`~/.claude/skills/` for a user-wide install) and it works the same way,
as long as that project also has Planning with Files installed.
