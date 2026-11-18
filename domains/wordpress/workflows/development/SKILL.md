---
name: wordpress-development
description: Orchestrate WordPress development in configured WordPress projects end to end, delegating to the domain-neutral roles (plan and implement → review → fix → browser QA → test → audit → commit/MR drafts) with a shared task file as live context. Use when the user runs /development, or asks to build, implement or fix a feature "end to end" / "with the full workflow" / "orchestrated". Also "/development resume" to continue a task, "/development list" to see tasks, and "/development cleanup" to delete finished ones.
argument-hint: <task description> | resume [slug] | list | cleanup
---

# WordPress development orchestrator

Arguments: the task description or approved Think brief supplied by the coordinator.

When run by the managed engine, follow only the requested stage. The engine owns progression and bounded fix loops. These role instructions do not themselves create isolated agents; disclose current-session execution if delegation is unavailable.

You coordinate the domain workflow. Delegate stages only when actual delegation is available; otherwise use the approved current-session managed stages and disclose that they are not independent agents. You own the task file and every decision point with the user. Baseline rules live in `../../standards/` relative to this skill. Private project facts and policies live under `$PI_STANDARDS_DIR/wordpress/projects/` (default standards root `$HOME/.pi/standards`); don't invent or override them here.

## Task workspace (shared dynamic context)

```
$PI_TASKS_DIR/wordpress/<project>/<YYYY-MM-DD>-<slug>/
  TASK.md            live context; only you edit it (template: ../../../../workflows/TASK.template.md relative to this skill)
  01-plan.md         each agent's full report, numbered in order
  02-implement.md
  03-review.md
  ...
```

- **TASK.md is the single source of task context.** Every agent reads it first. Keep it current after every step: status, decisions, files changed, open findings, log row, next step. Keep it under ~150 lines: summarize, link to reports for detail, delete fixed findings.
- **Reports** are written by the agent itself, at the path you give it. Number them in run order (`NN-<step>.md`, e.g. `05-fix-1.md`, `06-review-2.md`). Parallel agents get different numbers, so they never write to the same file.
- Agents never edit TASK.md. If an agent needs a decision, it says so in its summary and you ask the user.

## Modes

- `list`: list task folders under `$PI_TASKS_DIR/wordpress/` with each TASK.md's title, status and next step. Stop.
- `resume [slug]`: open that task (or the most recent non-`done` one for the current repo), read TASK.md, check the repo is on the recorded branch and `git status` matches "Files changed", tell the user where it stands, and continue from "Next step".
- `cleanup`: remove finished task folders (see "Cleanup" below). Stop.
- Otherwise: a new task, starting at step 0.

## Step 0. Set up

1. Identify the project with the startup procedure in `../../standards/README.md` relative to this skill and read its project file. No match → say so and ask how to proceed.
2. Read the project file's **Git conventions**: base branch, branch naming, commit style. They drive steps 1 and 7.
3. `git fetch origin` (read-only), then `git status` and `git branch --show-current` in the repo. If the tree is dirty with changes unrelated to this task, ask whether to continue on top of them, stash, or stop. Never stash or discard on your own.
   If the current branch is neither the project's base branch nor a branch for this task, ask which to start from.
4. Create the task folder and TASK.md from the template. Fill in project, repo, branch, base branch and base commit (`git rev-parse --short HEAD`), brief, date.
   If the arguments name a `/think` note (`Brief: $PI_THINK_DIR/<file>.md`), read its "Handoff brief" and "Decision" sections: put the brief in Brief, copy its decisions and constraints into "Decisions and constraints", and don't re-ask questions it already settled. Link the note in Brief.
5. **Choose the path** and record it:
   - **Light:** small, local changes (one or two files, no new entry points, no schema or data changes, no new assets). Implement → review → at most one fix round → report.
   - **Full:** everything else, including anything touching AJAX/REST/forms, the database, caching, cron, build config, or more than a few files.
   If unsure, choose full. The user can override.

## Step 1. Plan (full path only)

Call `developer` in **plan-only mode** with `model: router/auto` (design judgment is where a stronger model pays off; implement and fix steps use the agent's default model). It must not edit any files. It reads TASK.md and the code and writes a plan to `01-plan.md`: steps, files, data flow, caching/page-cache behavior, risks, open questions.

Show the user the plan summary and open questions. If they're on the base branch, propose a branch name that follows the project's naming convention (e.g. the project branch convention from local standards); follow the project branching convention documented in its local standards file. **Wait for approval.** Record the approved plan and every answer in TASK.md, then create the branch (from the up-to-date base branch) only if the user agreed.

Light path: no plan step, but still ask for the branch name (one line) if they're on the base branch.

## Step 2. Implement

Call `developer` to implement the approved plan (light path: the brief). Then update "Files changed" and "Deploy / server steps" from its summary. Check `git status` yourself so the file list is accurate.

If it reports a failing lint/build it couldn't resolve, go to step 4 with `debugger`.

## Step 3. Review

Call `code-reviewer` on the working tree diff against the base commit in TASK.md. Copy its 🔴 and 🟡 findings into "Open findings". 🔵 suggestions stay in the report unless the user asks for them.

No 🔴/🟡 → go to step 4b.

## Step 4. Fix loop (max 2 rounds; light path: 1)

- A failing command, error, or a finding whose cause isn't clear → `debugger`.
- Clear findings → `developer` in fix mode: fix only the listed findings, nothing else.

Then re-review (step 3), with the reviewer told to focus on the fixes and the earlier findings. Remove fixed findings from TASK.md.

After the last allowed round, if 🔴/🟡 remain, or the developer and reviewer disagree: **stop and ask the user** with the remaining findings. Options: fix differently, accept with a note (record it in Decisions), or stop.

## Step 4b. QA in the browser (both paths, when the change affects anything visible or interactive)

1. If front-end assets changed, make sure they're built: ask `developer` to run the build, or tell the user to (if they run the dev server themselves).
2. Call `qa` against the local site (URL in the project file). It derives scenarios from TASK.md and the diff, then tests the feature, logged-out vs logged-in, RTL, mobile, console and network, plus the page-cache approximation.
3. If a scenario needs a logged-in session, relay its request to the user (log in to the local site in the DevTools browser) and call it again.
4. Its ❌ results go to "Open findings" and through the fix loop (step 4, same round limit), then QA re-runs only the failed scenarios.
5. Record in TASK.md what QA couldn't test locally (e.g. real page cache, third-party APIs), so it shows up in the final report as a staging/production check.

Skip QA for changes with no runtime effect (docs, CI-only, pure refactor already covered by tests), and say so in the Log.

## Step 5. Test (full path, when the change has logic worth locking in)

Use the `test-writer` role with the project's actual test setup. Inspect configured suites and commands first. If no suitable suite exists, propose a minimal setup and obtain approval before creating one; record that decision. If the user declines tests, record that and move on.

Failing tests → step 4 with `debugger`, counting toward the same round limit.

## Step 6. Audits (only when relevant; can run in parallel)

- New or changed entry points (AJAX, REST, admin-post, forms, file uploads) → `security-auditor`, scoped to the changed entry points, not the whole repo.
- Changed front-end output on public pages → `performance-auditor`, comparing the affected page types on the local site before/after (relative comparisons; derive cache topology from this project's facts). Absolute numbers need staging or production; offer that in the final report instead.

Their 🔴/🟡 findings go to "Open findings" and through one more fix round if needed.

## Step 7. Finish

1. **Base branch freshness.** `git fetch origin`, then compare `origin/<base branch>` with the base commit in TASK.md. If it moved: list the new commits, and check for overlap with "Files changed" (`git diff --name-only <base sha> origin/<base branch>`). Overlap → warn the user and offer to rebase/merge before the MR; never rebase on your own. If a rebase/merge happens, re-run the review (step 3) on the result.
2. **Retrospective (propose, don't apply).** Look at this task's findings across review, QA, tests and audits. Propose updates to `$PI_STANDARDS_DIR/` only when they'd prevent a repeat:
   - a finding class not covered by any checklist → a new checklist rule;
   - a fact the agents had to discover or got wrong (URL, convention, plugin, server detail) → a project-file update;
   - a rule that produced a wrong or noisy finding → a correction.
   Show each proposal as a one-line diff summary and apply only the ones the user approves (date the project-file changes). No proposals is a fine outcome.
3. **Write the deliverables** into the task folder:
   - `COMMIT.md`: commit message(s) in the project's commit style (one per logical change if the work splits naturally).
   - `MR.md`: MR title, **labels** (from the project file's MR labels table, exact names; pick by the change type) and description in the project's style, with summary, what changed, how it was verified (review rounds, QA scenarios, tests, audits), what wasn't verified, deploy steps, and the target branch from the project file.
4. Set the status to `done` (or `blocked` with the reason) and write a final summary in TASK.md. Tell the user:
   - what was built, and the files changed;
   - what was verified (review rounds, QA, tests, audits) and what wasn't, including checks that need staging/production;
   - accepted or remaining findings;
   - deploy steps, phrased as what the deploy needs (asset build, Composer install, cache purge, ACF sync, server config). Production deploys run through a per-project script whose steps aren't known here, so don't present exact commands as the deploy procedure;
   - the task folder path.

Then ask whether to commit (using `COMMIT.md`), push, and open the MR (using `MR.md`: `glab mr create --target-branch <base branch> --title … --description … --label "<label>" --assignee "<project-configured-assignee>"`; quote labels with spaces and obtain a missing assignee from the user rather than hardcoding an account). **Don't do any of these without a yes.** After an MR exists, record its number and URL in TASK.md's **MR** row, and suggest `/merge-request-review <N>` as a final pass.

Keep the task folder until the MR is merged: review rounds may need `/development resume`. Mention `/development cleanup` for afterwards.

## Cleanup

1. Collect every task folder under `$PI_TASKS_DIR/wordpress/` and read each TASK.md's title, project, status, MR and Started date.
2. Check each task's MR state from the project's local repo path: `glab mr view <N> --output json` with the MR number from TASK.md, or, when no MR is recorded (older tasks), `glab mr view <branch> --output json` with the branch from TASK.md. Read `state`: `opened` / `merged` / `closed`; no MR found means "no MR". Use the GitLab host and repo from the project file. If glab fails, show the state as "unknown"; don't guess.
3. Show one table, grouped:
   - **Safe to delete:** MR `merged` or `closed`.
   - **Probably done:** status `done` or `blocked` with no MR recorded, or older than 30 days without activity (newest file in the folder). Show why.
   - **Keep:** MR still `opened`, or the task is in progress.
4. Ask which to delete: suggest the "safe" group, let the user add or remove tasks. **Delete nothing without a yes.** Never delete in-progress tasks unless the user names them explicitly.
5. Delete the confirmed folders (only paths inside `$PI_TASKS_DIR/`), and remove empty project folders left behind.
6. If task folders are tracked in the task workspace repository, offer to commit (`chore: clean up finished Pi tasks`) and push; don't do either without a yes. If they're ignored, there's nothing to commit.

## How to call an agent

Every delegation uses this shape. Fill in the brackets; don't paste TASK.md contents into the prompt, since the agent reads the file itself.

```
Task folder: <abs path>
1. Read <task folder>/TASK.md first. It's the live context: brief, approved plan, decisions,
   files changed, open findings. Respect every decision there.
2. Then read: <the specific earlier reports this step needs, e.g. 03-review.md>.
3. Your job: <one precise instruction: plan-only / implement the plan / fix findings F1, F3 /
   review the diff against <base sha> / write tests for … / audit entry points …>.
4. Read the WordPress pack's standards/README.md; resolve its path from the supplied workflow entry, not the application working directory.
5. Write your full report to <task folder>/<NN-step>.md.
   Do not edit TASK.md. Outside the task folder, change only what your role allows.
6. Reply with a summary of at most 15 lines: outcome, files touched, findings by severity
   (one line each, with IDs), questions for the user, and the report path.
```

**Models.** Use each agent's own model, except an explicitly configured planning profile (see step 1); physical models remain unconfirmed unless response metadata verifies them. Don't upgrade other steps on your own. If the Log shows `developer` repeatedly hitting the fix-round limit, mention it in the final report so the user can reconsider its model.

Only pass the reports a step needs (e.g. the fixer gets the review, not the plan history). Run independent agents (the two auditors) in parallel; everything else is sequential.
