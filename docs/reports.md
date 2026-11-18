# Task reports

Each report is one normalized evidence model, saved in three formats:

```text
<task-directory>/
├── TASK.md
├── FINAL.md
├── artifacts/
│   ├── shared-context.json
│   ├── report-details.json        optional coordinator-owned details
│   ├── briefs/                    stage handoffs
│   └── usage.jsonl                recorded response usage, when available
└── reports/
    ├── final.json                 canonical report snapshot, schemaVersion 1
    └── final.html                 self-contained dark HTML
```

The schema is `schemas/task-report.schema.json`. JSON, Markdown, and HTML are generated from the same model; do not maintain separate narrative reports by hand. Source inputs remain the task, shared context, stage handoffs, and coordinator-supplied details. Regeneration reads those inputs again; it does not parse edits to FINAL.md or final.html.

## Contents and presentation

Reports cover the issue/goal, recorded plan approval, decisions/deviations, changed files and explanations, verification, acceptance criteria, findings, risks, follow-up work, delivery, stage summaries, and recorded usage.

The HTML uses an offline dark layout with overview cards, section navigation, responsive tables, readable system fonts, status text plus color, keyboard focus/skip navigation, native expandable details, reduced-motion support, and a light print stylesheet. No JavaScript, external fonts, CDN, or remote assets are required. Use the browser's Print command. Closed disclosures are expanded by print styling.

Important distinctions:

- A stage completing does not mean its checks passed, its acceptance criteria were met, or the code was deployed.
- Command strings without outcomes are **unverified**, never inferred passing checks.
- Checks use `passed`, `failed`, `skipped`, or `unverified`. A nonzero exit code is a failure even if a conflicting status says passed.
- Acceptance uses `met`, `unmet`, or `unverified`. A claimed `met` without evidence remains unverified.
- Delivery uses `yes`, `no`, or `unknown` independently for committed, published, and deployed. A claimed yes without evidence remains unknown.
- Approval is `recorded` only when the current plan matches the stored approved-plan hash/version. This records approval metadata; it is not independent proof of the human approval conversation.
- Findings are reported history, not automatically resolved by later silence. Use explicit finding status when resolution is known.
- Blank arrays and missing information mean **not recorded**, not “none exist.” Usage/cost and physical response models remain unknown when unavailable; virtual router names do not establish physical dispatch.

## Managed workflows

The runtime writes all formats on successful completion, blocking findings, missing handoffs after retry, start/continuation errors, user stop, and abort of an active managed run. Invalid command syntax or a refused task that never started does not create a workflow report automatically.

A stop request during a turn waits for that turn to settle before reporting, so evidence written during the turn can be included. Aborts do not schedule another stage. Stopped tasks retain their resumable lifecycle stage; report status `stopped` and source lifecycle are displayed separately.

Each new run gets a run ID. Handoffs and usage are filtered to that run to avoid importing stale results from a previous execution. Legacy handoffs without run IDs are labeled with a review warning when regenerating a legacy report. Corrupt handoff JSON follows the same bounded retry/block/report path as a missing handoff instead of leaving the run active.

The finish-stage `workflow_handoff` tool accepts optional `reportDetails` using the structure below. Other stages continue recording `commandsRun`, findings, changed files, risks, and next checks. The runtime performs final generation; stage agents should not create competing HTML/Markdown narratives.

Reports are snapshots, not a live dashboard. A resumed run does not rewrite an old report until it next stops/blocks/completes or an explicit snapshot is requested. Check the generation date and lifecycle state. Final report paths appear in runtime notifications; the coordinator should return them in the final chat summary.

## Add accurate report details

Maintain `artifacts/report-details.json` in the task workspace, or pass an explicitly chosen JSON details file to the CLI. Known fields from the latest stage `reportDetails` are used first; the saved details file and explicit CLI details override them. Only known report fields are exported; arbitrary raw logs and unknown metadata are not copied.

```json
{
  "summary": "The invalid-state bug is fixed; deployment is pending.",
  "changes": [
    { "file": "src/state.js", "summary": "Reject invalid transitions before updating state." }
  ],
  "planDeviations": ["Used the existing test harness rather than adding a dependency."],
  "verification": [
    {
      "name": "Focused regression tests",
      "command": "npm test -- state",
      "exitCode": 0,
      "result": "Recorded test output reports 12 passing tests.",
      "evidence": ["Local test log: artifacts/state-tests.log"]
    },
    {
      "name": "Production smoke test",
      "status": "skipped",
      "result": "No production access was approved."
    }
  ],
  "acceptanceCriteria": [
    {
      "criterion": "Invalid transitions do not change state",
      "status": "met",
      "evidence": ["Focused regression verifies the state remains unchanged."]
    }
  ],
  "risks": ["Real application smoke testing is still pending."],
  "nextSteps": ["Request deployment approval."],
  "delivery": {
    "committed": { "status": "no", "evidence": ["Changes remain uncommitted."] },
    "published": { "status": "no", "evidence": ["No release publication was performed."] },
    "deployed": { "status": "no", "evidence": ["Deployment was not approved."] }
  }
}
```

These are examples, not instructions to claim these results. Record only actual evidence. A string entry in shared-context acceptanceCriteria or TASK.md's Acceptance criteria section is unverified until evidence-backed details are provided. TASK.md's Plan deviations section is used when structured deviations are absent.

## Approved main-session work

Reporting does not require a framework pack or a managed workflow:

```bash
piw report init fix-search "Fix search behavior"
```

This returns a new task directory under `$PI_TASKS_DIR/general/main-session/<date>-fix-search` (default task root: `$HOME/.pi/tasks`). `general/main-session` is a report workspace, not an invented executable framework domain. Creation does not execute code or imply plan approval.

After real approval, the coordinator records the brief, approved plan, constraints, and acceptance criteria, and can use the existing approval commands:

```bash
piw task transition general/main-session/<date>-fix-search awaiting-approval
piw task approve general/main-session/<date>-fix-search
```

Then perform only the approved main-session work. Maintain report details, update TASK.md/shared lifecycle honestly, and generate the outcome snapshot:

```bash
piw report generate /absolute/task-directory completed
# Or: blocked / stopped / in-progress
```

This command only generates reports; it does not execute code, alter task approval, launch agents, commit, publish, deploy, or update source lifecycle state. Main-session reporting is an explicit coordinator responsibility, not an automatic watcher of arbitrary chat activity. The Think and generic development protocols require it for non-trivial approved execution.

## Regenerate or take a snapshot

```bash
piw report generate /absolute/task-directory
piw report generate /absolute/task-directory blocked
piw report generate /absolute/task-directory completed /explicit/report-details.json
```

Without status, the generator uses active run state, recorded terminal run status, or task lifecycle. Active managed runs can only be snapshotted as `in-progress`; a manual terminal report cannot override an active execution. Explicit statuses on inactive/main-session snapshots do not mutate the underlying lifecycle. Output paths are printed as JSON.

## Privacy, boundaries, and limitations

- Task directories must be inside the configured task workspace after resolving symlinks. Input files cannot point outside the task. Symlinked output files/directories are rejected.
- Reports are written with private file permissions (`0600`, reports directory `0700`), using atomic replacement per file. FINAL.md is written last as a compatibility marker. The three-file bundle is not a filesystem transaction.
- Report content is escaped, not executed as HTML/Markdown. Sources are displayed as text, not arbitrary active links. A restrictive CSP prevents scripts and external assets in generated HTML.
- Common password/token/key assignments, CLI credential flags, authorization/cookie headers, credential-bearing URLs, common token formats, and private-key blocks are redacted across **all** formats. Optional `redactValues` in report details can specify exact sensitive strings (three or more characters); that list is never exported. Do not add credentials merely for testing redaction.
- Redaction is best-effort, not a DLP guarantee. Unrecognized secrets, sensitive code, paths, and personal data may remain. Review before sharing; no report is uploaded or published automatically.
- Inputs are bounded (4 MiB per input file, 250 items per collection, 16,000 characters per text field). Invalid optional JSON, non-object metadata, malformed usage records, and unreadable/non-directory brief collections are omitted with warnings. Missing or unsafe TASK.md prevents generation rather than fabricating a report.
- Quality depends on recorded evidence. No independent reviewer, real application coverage, complete redaction, deployment, or compliance guarantee is implied.

## Verification

`npm test` covers schema conformance for generated data, shared-format consistency, truthful unknown states, redaction, injection escaping, path boundaries, main-session CLI reporting, run isolation, and real Pi lifecycle scenarios with a mock model (completed, blocked, missing handoff, stop, and abort). Browser checks cover desktop/mobile layout, offline behavior, keyboard access, reduced motion, contrast samples, and print-mode expansion. A full assistive-technology audit is not implied.
