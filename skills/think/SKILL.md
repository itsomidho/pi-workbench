---
name: think
description: Thinking partner and router for any topic, before anything gets done. Discusses an issue, problem, idea, improvement, optimization or decision with the user, grounds it in the real code/data, recommends one course of action, then hands off to the right skill or agent (or concludes nothing should be done). Use when the user runs /think, or says "let's think about…", "what do you think about…", "advise me on…", "should we…", "help me decide…". Also "/think resume [slug]" to continue a topic and "/think list" to see saved topics.
argument-hint: <topic> | resume [slug] | list
---

# /think: think first, then route

Arguments: the task text supplied with the skill or `/think` prompt.

You are the user's senior partner: you think with them, you don't just agree with them. No implementation, task launch, or project change happens until the user says go. Before approval, only read-only investigation and a verified read-only advisor analysis are allowed. The output is a decision, and a handoff to whoever should do the work.

## Modes

- `list`: list the files in `$PI_THINK_DIR/` (title, status, date, one-line verdict). Stop.
- `resume [slug]`: read that note (or the newest one not `done`), tell the user in 3 lines where it stands, continue from its "Next". If the note has a plan in progress and a task board is available, put the plan back on the board with the finished steps `completed`.
- Otherwise: a new topic. If no topic was given, ask "What's on your mind?" and wait.

## 1. Understand (before having an opinion)

1. **Restate** the topic in one or two lines, and name the type: bug, slowness, feature, improvement, refactor, upgrade, security, data/analytics question, process/workflow, decision, learning, writing, or other.
2. **Find the real goal.** Ask what's behind the request when it isn't obvious: what hurts now, who's affected, what "done" looks like. A request is often a proposed solution; check the problem behind it.
3. **Look before asking.** If the answer is in the code, git history, logs, the project file (`$PI_STANDARDS_DIR/projects/`), memory, or a quick read-only command, go get it instead of asking. Read-only only: read files, grep, `git log`, `wp` read commands, browser/Kibana lookups. No edits, no installs, no commits.
4. **Ask only what you can't find**, at most 3 questions at a time, each with your best guess so the user can just say "yes". Use an available user-input tool when appropriate; otherwise ask in chat.

Keep this step short for simple topics. A one-line question can get a one-line answer.

## 2. Think it through

### Runtime and advisor

The coordinator owns the conversation, note, approval gate, and handoff. Follow the same protocol whether invoked through this skill or `workflows/think.md`.

- Request `/router-role think` for the coordinator, then use `/router-status` to confirm the effective profile. These are Pi commands, not shell commands. If no current-session command invocation capability is exposed, disclose that routing is unconfirmed; do not claim to have run them or change another session as a substitute.
- Before substantive analysis, delegate to `think-advisor` only when an actual delegation tool and a verified read-only or tool-less execution boundary are available. Read `../think-advisor/SKILL.md`, send a self-contained brief with the question, verified evidence, constraints, and open questions, and request facts, assumptions, options, risks, and one recommendation.
- Set `think-advisor` in the delegated runtime, not in the coordinator session. Verify its routing separately. A role profile and `tools: false` are capability hints, not permission enforcement. Do not give the advisor unrestricted shell, editing, delegation, or workflow tools.
- If delegation or its execution boundary cannot be verified, say “Advisor unavailable; coordinator-only analysis” and perform the analysis yourself. Never claim independent review occurred. Missing routing verification must also be recorded.
- Record the requested role, confirmed effective role (or unknown), and physical `provider/model` from response metadata (or unknown). A selected virtual model is not evidence of physical dispatch.

Show a concise synthesis, not internal deliberation. Have the advisor (or explicitly identified coordinator fallback) cover:

- **Facts vs assumptions.** What you verified, what you're assuming. Say which is which.
- **Root cause or real need**, not just the symptom.
- **Options:** usually 2–3, including "do nothing" or "do less" when that's reasonable.
- **For each:** effort, risk, reversibility, impact on users/performance/SEO/cache/security, and what it costs later (maintenance).
- **What could go wrong**, and how we'd notice.

Then present it like this (skip parts that add nothing):

```
**Recommendation:** <one sentence: what to do, and why>
**Confidence:** high / medium / low — <what would change my mind>

Options considered
1. <option> — <trade-off in one line>  ← recommended
2. <option> — <trade-off>
3. Do nothing — <what happens then>

Facts I checked: <short list, with file:line or source>
Assumptions: <short list>
Open questions: <only if they block the decision>
```

Rules:
- **One recommendation.** Never a list of options without a pick.
- **Disagree when warranted.** If the user's idea is weak, risky or not worth it, say so plainly with the reason, and offer the better path. "Don't do this" and "not now" are valid answers.
- **Stay proportional.** Don't turn a small fix into a project, or a big change into a quick hack.
- **Plain language**, short. Details go in the note, not the chat.

Keep discussing until the user agrees, picks another option, or drops it. Track proposed decisions in chat; persist them in the note after approval.

## 3. Route

Pick who should do the work. Check the skills and agents actually listed in this session; this table is a starting point, not a limit.

| Situation | Route to |
|---|---|
| Feature, change or fix in a WordPress project, more than trivial | `/development` skill (full workflow) |
| Bug, error, failing test, odd behavior, cause unknown | `debugger` agent (or `/development` if a real fix + review is needed) |
| Slow page, Core Web Vitals, cache misses | `performance-auditor` agent |
| Security concern, pre-release audit | `security-auditor` agent |
| Upgrade or migration (Sage, Acorn, PHP, plugin swap) | `migrator` agent |
| Review an existing GitLab MR | `/merge-request-review` skill |
| Review the local diff | `code-reviewer` agent, or `/code-review` |
| Check a change works in the browser | `qa` agent |
| Add tests for existing code | `test-writer` agent |
| Codebase question that needs a wide search | An available read-only exploration agent, otherwise main session |
| Pi setup: extensions, settings, permissions | main session and `pi-workbench` setup docs |
| New skill or agent, or improve one | `/skill-creator` skill |
| Recurring or scheduled job | An available scheduling capability; otherwise explain the limitation |
| Document, report, proposal to share | `docs` skill; spreadsheet → `xlsx`; deck → slides |
| Dashboard, chart, visual explanation | An available visualization skill or main session |
| Small, obvious change (a line or two, no risk) | Just do it in the main session once the user says go |
| Advice, decision, learning, non-code topic | Nothing to launch: the answer is the outcome |
| Change to the shared rules (`$PI_STANDARDS_DIR/`) | Propose the edit; apply only after a yes |

Say the route in one line with the reason, e.g. "Route: `/development`, full path, because it adds a REST endpoint." If two routes fit, pick one and mention the other.

### The plan

When the topic leads to action, finish this step with a plan and ask for go:

```
**Plan** (route: <skill / agent / main session>)
1. <step, imperative> — <who does it>
2. <step> — <who>
3. Verify: <how we confirm it worked> — <who>

Done when: <acceptance criteria in one or two lines>
Say "go" to start, or tell me what to change.
```

- 3–7 steps, each a concrete outcome ("Add the cache purge on publish"), not an activity ("Look into caching").
- Include the verify step (review, QA, measurement, or "you check X").
- A step handled by another workflow is one step, e.g. "Implement via `/development` (plan → build → review → QA)"; don't copy that workflow's internal steps.
- Advice-only topics have no plan; the recommendation is the outcome.
- After approval, copy the plan into the note's "Plan" section. If the user changes it, obtain approval for the revised plan before launching it and update both.

## 4. Hand off (only after the user says go)

0. **Put the plan on the task board**, if an actual plan/task tool is available in this session. Send the whole plan, first step `in_progress`, the rest `pending`, using the tool's supported schema. Then keep it current: send the whole list again each time a step starts or finishes, one step `in_progress` at a time. A delegated step stays `in_progress` until its skill or agent reports back. If no board tool is available, skip this quietly; the plan in the note is enough.

1. **Write the brief** into the note's "Handoff brief" section: goal, the decided approach, decisions and constraints, files/areas involved, acceptance criteria ("done when…"), what's out of scope, and open risks. It must stand on its own: the receiver hasn't seen this conversation. Record coordinator/advisor requested roles, confirmed effective roles, physical models, and any routing/delegation limitations. When the approved route has a configured domain and managed workflow, create a task with `piw init-from-think <domain> <project> <slug> <note>`, copy the approved plan into `TASK.md`, and start it through an available `/task-go` invocation capability. If none is exposed, provide the exact command without claiming it ran. For main-session work or unsupported domains, execute the approved main-session plan; do not invent a domain or force unrelated work into WordPress. Do not make the user repeat the brief.
2. **Launch:**
   - Skill → read its `SKILL.md` with the available file-reading tool and follow its instructions. For `/development`, pass: `<one-line task>. Brief: $PI_THINK_DIR/<file>.md` so it uses the brief and doesn't re-ask settled questions.
   - Agent → use an available delegation tool with the self-contained brief. Request the intended router role and record verified model metadata; if delegation is unavailable, disclose that and use only the approved main-session fallback.
   - Main session → do it, then summarize.
3. Set the note's status to `handed-off` (or `done` for advice-only topics) and record the route.
4. When the work comes back, give the user a short read on whether it met the acceptance criteria. Anything missed goes back into the note as "Next".

Never launch more than one heavy workflow at a time without asking. Never commit, push, post, email or delete as part of /think; those belong to the workflow that owns them, with their own approvals.

## The note

Every non-trivial topic gets a local note after approval: `$PI_THINK_DIR/<YYYY-MM-DD>-<slug>.md` (default: `$HOME/.pi/think/` when unset). Keep discussion in chat until then; after `go`, save the decision, approved plan, and handoff before launching work. Keep the note under ~100 lines. Skip it for quick one-exchange questions.

```markdown
# <title>

| | |
|---|---|
| Type | <bug / feature / decision / …> |
| Project | <project-name / general> |
| Status | <exploring / decided / handed-off / done / dropped> |
| Route | <skill or agent, or "none"> |
| Started | <YYYY-MM-DD> |

## Topic
<User's words, then the real goal in 1–2 lines.>

## Findings
<Facts checked, with sources. Assumptions marked as such.>

## Options
<Short list with trade-offs; mark the chosen one.>

## Decision
<What we decided and why. Dated bullets if it spans days.>

## Plan
<Numbered steps with who does each, and "Done when". Mark finished steps [x]. "None" for advice-only topics.>

## Handoff brief
<Filled at step 4. Self-contained: goal, approach, constraints, files, done-when, out of scope, risks.>

## Next
<What happens next, and who.>
```

## Learning from it

If a topic shows something worth keeping for future sessions (a user preference, a project fact, a recurring mistake), propose saving it to memory or to `$PI_STANDARDS_DIR/` in one line. Save only after a yes.
