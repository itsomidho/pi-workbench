# Workbench readiness and supported boundaries

Workbench is ready for controlled use only when its runtime, domain, approval, model access and verification requirements are satisfied. A green test suite is not a guarantee of model judgment, framework correctness or provider access.

## Repeatable local checks

```bash
npm test
npm run check
git diff --check
piw doctor
piw domain check
```

The suite covers domain/skill discovery, canonical local-project matching, approval hashes, current-session managed stages, review/fix/re-review, bounded handoff failures, stop/abort/report paths, CLI forwarding, report escaping/redaction/path boundaries, and router retry/fallback/exhaustion through real Pi processes with deterministic model fixtures. A forced provider-issued write is rejected in the tool-less runtime test. These fixtures do not call paid models or modify user applications.

## Verify a usable model before daily work

A provider can return a healthy catalog containing models that its account guardrails do not permit. Do not weaken those policies to make a test pass. Verify one approved model and restrict the router to approved candidates:

```bash
piw run --provider <provider> --model <approved-model>
piw run --models '<provider>/<approved-model>'
# Or multiple approved candidates for fallback inside that scope:
piw run --models '<provider>/<model-one>,<provider>/<model-two>'
```

`piw run` defaults to `router/auto`; scoped candidates must still satisfy the requested role's capability metadata. Confirm `/router-role think` and `/router-status` in the actual session, and record assistant physical `provider/model`, not just the virtual selection. The router avoids every failed candidate in a retry chain; Pi controls retry eligibility and limits. A failed catalog/account combination can exhaust retries without reaching an accessible model. JSON/RPC process or command success does not imply a successful model response: inspect `stopReason` and `errorMessage`.

## Controlled end-to-end smoke

Use an explicitly disposable repository and isolated standards/task directories. Confirm its domain from repository evidence, read its exact manifest route and existing local project file, and obtain explicit plan approval before task creation/execution. Then exercise implementation, a genuine review finding, fix/re-review, applicable QA, tests, audit and finish. Verify the reports contain actual command results and do not invent acceptance, delivery or skipped browser checks. Exercise stop/resume separately. Do not deliberately damage a user application to force a fix loop.

A live utility fixture demonstrates orchestration, not application-level browser, security or performance competence. Each framework pack still needs project-specific smoke tests in its approved environment. A fixture starting from a paused review is evidence for review/fix/re-review, not evidence that earlier implementation ran for that task.

## Honest execution limits

- Managed stages run in the current session. Role changes do not create independent reviewers or enforced read-only permissions.
- Think uses coordinator-only analysis when verified read-only/tool-less delegation is unavailable. A manually orchestrated tool-less child test does not establish an automatic delegation feature or independent source review.
- Project standards matching reads explicit identity fields, expands home-relative paths and canonicalizes aliases. Ambiguous, unsafe, partial or unsupported formats require clarification; filenames are not identities.
- Legacy report inputs remain conservative. Resolution status, acceptance and delivery need explicit recorded metadata; `blocking: false` alone does not establish that a finding was resolved.
- Browser QA needs a reachable test browser and trusted local certificate authority. Never fix this by globally disabling certificate validation or copying an everyday browser's credentials into an automation profile.
- Live GitLab MR posting, commits, publication, deployment, production access, paid-service effects and destructive tests require separate authorization. Do not count them as verified from development-fixture success.
- Release/update testing and a successful local session do not prove compatibility with every future Pi/provider/model version. Re-run checks after upgrades and retain raw evidence privately.

At completion, report which paths were actually exercised, which model/account worked, checks that failed or remained unavailable, and whether any commit/publication/deployment occurred. Return the generated HTML and Markdown report paths. Do not silently turn Workbench readiness testing into remediation of a user's application.
