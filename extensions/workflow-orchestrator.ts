import { domainStageContext } from "../scripts/domains.mjs";
import { requestRouterRole } from "../scripts/router-role.mjs";
import { assertApprovedPlan } from "../scripts/workflow-approval.mjs";
import { previousStage, nextWorkflowStage, validHandoff as validBrief } from "../scripts/workflow-progress.mjs";
import fs from "node:fs";
import path from "node:path";
import { Type } from "typebox";
import { randomUUID } from "node:crypto";
import { writeTaskReport } from "../scripts/report-render.mjs";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

type Stage = "implement" | "review" | "fix" | "qa" | "test" | "audit" | "finish";
type RunState = { taskDir: string; identifier: string; stage: Stage; fixRounds: number; maxFixRounds: number; handoffRetries: number; active: boolean; attemptId?: string; runId?: string; stopRequested?: boolean; reportStatus?: string; reportReason?: string };
const stages: Stage[] = ["implement", "review", "fix", "qa", "test", "audit", "finish"];

// Describe new model-emitted evidence explicitly. Saved legacy briefs still use
// the conservative report reader; prose is never upgraded to a passing check.
const proof = Type.Array(Type.String({ minLength: 1 }));
const checkFields = {
  status: Type.Optional(Type.String({ enum: ["passed", "failed", "skipped", "unverified"] })),
  exitCode: Type.Optional(Type.Integer()),
  result: Type.Optional(Type.String()),
  evidence: Type.Optional(proof),
};
const commandResult = Type.Object({ command: Type.String({ minLength: 1 }), name: Type.Optional(Type.String()), ...checkFields }, { additionalProperties: false });
const verificationResult = Type.Object({ name: Type.String({ minLength: 1 }), command: Type.Optional(Type.String()), ...checkFields }, { additionalProperties: false });
const deliveryResult = Type.Object({
  status: Type.String({ enum: ["yes", "no", "unknown"] }),
  evidence: Type.Optional(proof),
}, { additionalProperties: false });

function tasksRoot() { return process.env.PI_TASKS_DIR ?? path.join(process.env.HOME ?? ".", ".pi/tasks"); }
function runFile() { return path.join(tasksRoot(), "orchestration.json"); }
function taskDir(identifier: string) {
  const parts = identifier.split("/");
  if (parts.length !== 3 || !/^[a-z][a-z0-9-]*$/.test(parts[0]) || !/^[a-z][a-z0-9-]*$/.test(parts[1]) || !/^\d{4}-\d{2}-\d{2}-[a-z][a-z0-9-]*$/.test(parts[2])) return null;
  const root = path.resolve(tasksRoot());
  const dir = path.resolve(root, ...parts);
  return dir.startsWith(`${root}${path.sep}`) ? dir : null;
}
function readRun(): RunState | null { return fs.existsSync(runFile()) ? JSON.parse(fs.readFileSync(runFile(), "utf8")) : null; }

function writeRun(state: RunState) {
  fs.mkdirSync(tasksRoot(), { recursive: true });
  fs.writeFileSync(runFile(), JSON.stringify(state, null, 2) + "\n");
  const stateFile = path.join(state.taskDir, "artifacts", "state.json");
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  const current = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, "utf8")) : { schemaVersion: 1 };
  fs.writeFileSync(stateFile, JSON.stringify({ ...current, runId: state.runId, reportStatus: state.reportStatus, reportReason: state.reportReason, stage: state.stage, fixRounds: state.fixRounds, maxFixRounds: state.maxFixRounds, active: state.active, updatedAt: new Date().toISOString() }, null, 2) + "\n");
}
function recordUsage(state: RunState, message: any) {
  if (message?.role !== "assistant" || !message.usage) return;
  const file = path.join(state.taskDir, "artifacts", "usage.jsonl");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify({ timestamp: new Date().toISOString(), runId: state.runId, provider: message.provider, model: message.model, usage: message.usage }) + "\n");
}
function statusFile(dir: string) { return path.join(dir, "TASK.md"); }
function status(dir: string) { return fs.readFileSync(statusFile(dir), "utf8").match(/^\| Status \| (.+) \|$/m)?.[1]; }

function updateStatus(dir: string, next: string) {
  const file = statusFile(dir);
  const text = fs.readFileSync(file, "utf8");
  fs.writeFileSync(file, text.replace(/^(\| Status \| ).*?( \|)$/m, `$1${next}$2`));
  const sharedFile = path.join(dir, "artifacts", "shared-context.json");
  if (fs.existsSync(sharedFile)) {
    const shared = JSON.parse(fs.readFileSync(sharedFile, "utf8"));
    shared.status = next;
    shared.updatedAt = new Date().toISOString();
    fs.writeFileSync(sharedFile, JSON.stringify(shared, null, 2) + "\n");
  }
}
function brief(dir: string, stage: string): any | null {
  const file = path.join(dir, "artifacts", "briefs", `${stage}.json`);
  try { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null; }
  catch { return null; } // A damaged handoff follows the same bounded retry path as a missing one.
}
function writeBrief(dir: string, stage: string, input: any, attemptId: string, runId?: string) {
  const file = path.join(dir, "artifacts", "briefs", `${stage}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const value = { schemaVersion: 1, stage, attemptId, runId, reportDetails: input.reportDetails, status: "completed", summary: input.summary, changedFiles: input.changedFiles ?? [], findings: input.findings ?? [], commandsRun: input.commandsRun ?? [], knownRisks: input.knownRisks ?? [], nextChecks: input.nextChecks ?? [], evidence: input.evidence ?? [], createdAt: new Date().toISOString() };
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
  return value;
}
function finalizeRun(state: RunState, ctx: ExtensionContext, reportStatus: "completed" | "blocked" | "stopped", reason: string) {
  state.active = false;
  state.stopRequested = false;
  state.reportStatus = reportStatus;
  state.reportReason = reason;
  writeRun(state);
  if (reportStatus === "completed") updateStatus(state.taskDir, "done");
  if (reportStatus === "blocked") updateStatus(state.taskDir, "blocked");
  try {
    const result = writeTaskReport(state.taskDir, { status: reportStatus, reason, runId: state.runId });
    ctx.ui.notify(`Task ${reportStatus}. Report: ${result.paths.html}`, reportStatus === "completed" ? "info" : "warning");
  } catch {
    ctx.ui.notify(`Task ${reportStatus}, but report generation failed. Retry: piw report generate "${state.taskDir}" ${reportStatus}`, "error");
  }
}
function promptFor(state: RunState, context: any) {
  const instructions: Record<Stage, string> = {
    implement: "Implement only the approved plan. Do not expand scope.",
    review: "Review the implementation against the task, plan, standards, and diff. Record every finding with id, severity, file, line, summary, blocking, and evidence.",
    fix: "Fix only the blocking findings from the previous review. Do not expand scope. Re-run focused verification.",
    qa: "Run relevant user-facing QA scenarios and record evidence, including console, network, responsive, accessibility, and cache checks when applicable.",
    test: "Run or add focused tests for the changed behavior. Prefer deterministic commands and record their results.",
    audit: "Run the relevant security and quality audits within the approved scope. Record findings and evidence.",
    finish: "Summarize issue, approved plan, changes, deviations, acceptance criteria, verification outcomes, risks, follow-ups, and delivery evidence in workflow_handoff.reportDetails. The runtime generates reports/final.json, reports/final.html, and FINAL.md. Do not claim checks passed from a command name or infer delivery from completion. Do not commit, push, publish, or open a merge request.",
  };
  const handoffRetry = state.handoffRetries > 0 ? "The previous response did not create a valid handoff. Call workflow_handoff now with the evidence already collected." : "";
  const evidenceInstructions = 'Call workflow_handoff with commandsRun objects {command, exitCode, result, evidence}, not prose strings. Record the actual exitCode only when observed; omit it for checks not run. reportDetails.verification uses objects {name, command, status, exitCode, result, evidence}; acceptanceCriteria uses {criterion, status: "met"|"unmet"|"unverified", evidence: ["specific evidence"]}. Reuse exact TASK.md criterion text. reportDetails.changes uses {file, summary}. reportDetails.delivery uses committed/published/deployed, each {status: "yes"|"no"|"unknown", evidence: ["specific evidence"]}. Never infer passing tests or delivery from stage completion; use skipped/unverified/unknown when appropriate. A claimed met or yes needs evidence.';
  return `${handoffRetry}\n${instructions[state.stage]}\n${evidenceInstructions}\n\nTask directory: ${state.taskDir}\nShared context: ${path.join(state.taskDir, "artifacts/shared-context.json")}\nPrevious brief: ${JSON.stringify(context)}\nExpected handoff stage: ${stageNumber(state.stage)}-${state.stage}\nHandoff brief path: ${path.join(state.taskDir, "artifacts", "briefs", `${stageNumber(state.stage)}-${state.stage}.json`)}\nWrite the human report and call the workflow_handoff tool with the completed summary and evidence. Stop and request user input for destructive actions, missing access, unresolved scope, or repeated failure.`;
}
function stageNumber(stage: Stage) { return String(stages.indexOf(stage) + 2).padStart(2, "0"); }
function previousBrief(state: RunState) {
  const previous = previousStage(state.stage, state.fixRounds) as Stage | null;
  return previous ? brief(state.taskDir, `${stageNumber(previous)}-${previous}`) : null;
}
function launchWith(pi: ExtensionAPI) {
  return async function launch(state: RunState, ctx: ExtensionContext, send: (prompt: string) => void | Promise<void>) {
    try {
      assertApprovedPlan(state.taskDir);
      const previous = previousBrief(state);
      const domain = domainStageContext(state.identifier.split("/")[0], state.stage);
      requestRouterRole(pi, domain.routerRole);
      state.runId ??= randomUUID();
      state.stopRequested = false;
      state.reportStatus = "in-progress";
      state.reportReason = "";
      state.attemptId = randomUUID();
      writeRun(state);
      ctx.ui.notify(`Workflow stage: ${state.stage} (${domain.role}; current session)`, "info");
      await send(`${promptFor(state, previous)}\n\n${domain.text}`);
    } catch (error) {
      finalizeRun(state, ctx, "blocked", `Workflow could not continue: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
}

export default function (pi: ExtensionAPI) {
  const launch = launchWith(pi);
  pi.registerTool({
    name: "workflow_handoff",
    label: "Workflow handoff",
    description: "Write the compact, structured handoff brief for the currently running workflow stage. Use structured command outcomes, acceptance evidence, and delivery states; never prose strings in report collections.",
    promptGuidelines: ["Use workflow_handoff commandsRun objects with observed exitCode and result; never invent outcomes. workflow_handoff reportDetails needs structured verification, acceptanceCriteria, changes, and delivery objects. Missing evidence remains unverified/unknown."],
    parameters: Type.Object({
      stage: Type.String({ description: "Expected stage brief filename, for example 02-implement or 03-review" }),
      summary: Type.String(),
      changedFiles: Type.Optional(Type.Array(Type.String())),
      findings: Type.Optional(Type.Array(Type.Any())),
      commandsRun: Type.Optional(Type.Array(commandResult)),
      knownRisks: Type.Optional(Type.Array(Type.Any())),
      nextChecks: Type.Optional(Type.Array(Type.Any())),
      evidence: Type.Optional(Type.Array(Type.Any())),
      reportDetails: Type.Optional(Type.Object({
        summary: Type.Optional(Type.String()),
        changes: Type.Optional(Type.Array(Type.Object({ file: Type.String({ minLength: 1 }), summary: Type.String() }, { additionalProperties: false }))),
        verification: Type.Optional(Type.Array(verificationResult)),
        acceptanceCriteria: Type.Optional(Type.Array(Type.Object({
          criterion: Type.String({ minLength: 1 }),
          status: Type.String({ enum: ["met", "unmet", "unverified"] }),
          evidence: Type.Optional(proof),
        }, { additionalProperties: false }))),
        planDeviations: Type.Optional(Type.Array(Type.String())),
        risks: Type.Optional(Type.Array(Type.String())),
        nextSteps: Type.Optional(Type.Array(Type.String())),
        delivery: Type.Optional(Type.Object({
          committed: Type.Optional(deliveryResult),
          published: Type.Optional(deliveryResult),
          deployed: Type.Optional(deliveryResult),
        }, { additionalProperties: false })),
      }, { additionalProperties: false })),
    }),
    async execute(_toolCallId, params) {
      const state = readRun();
      if (!state?.active) return { content: [{ type: "text", text: "No active workflow." }], details: {} };
      const expected = `${stageNumber(state.stage)}-${state.stage}`;
      if (params.stage !== expected) return { content: [{ type: "text", text: `Expected handoff stage ${expected}.` }], details: {} };
      if (!state.attemptId) throw new Error("No active stage attempt; resume the workflow first.");
      const value = writeBrief(state.taskDir, expected, params, state.attemptId, state.runId);
      return { content: [{ type: "text", text: `Handoff saved: ${expected}` }], details: value };
    },
  });
  pi.registerCommand("task-go-resume", {
    description: "Resume the persisted workflow for a task",
    handler: async (args, ctx) => {
      const state = readRun();
      const requested = args.trim();
      if (!state || (requested && requested !== state.identifier)) { ctx.ui.notify("No matching paused workflow found.", "error"); return; }
      if (state.active) { ctx.ui.notify("Workflow is already active.", "info"); return; }
      if (!fs.existsSync(statusFile(state.taskDir))) { ctx.ui.notify("Workflow task no longer exists.", "error"); return; }
      state.active = true;
      writeRun(state);
      await launch(state, ctx, (prompt) => pi.sendUserMessage(prompt, { triggerTurn: true }));
    },
  });

  pi.registerCommand("task-go", {
    description: "Run the approved task through the development workflow",
    handler: async (args, ctx) => {
      const identifier = args.trim();
      const dir = taskDir(identifier);
      if (!dir || !fs.existsSync(statusFile(dir))) { ctx.ui.notify("Usage: /task-go <domain>/<project>/<date-slug>", "error"); return; }
      if (status(dir) !== "implementing") { ctx.ui.notify(`Task must be approved and implementing; current status is ${status(dir) ?? "unknown"}.`, "error"); return; }
      try { assertApprovedPlan(dir); }
      catch (error) { ctx.ui.notify(error instanceof Error ? error.message : String(error), "error"); return; }
      const existing = readRun();
      if (existing?.active) { ctx.ui.notify(`Another workflow is active: ${existing.identifier}`, "error"); return; }
      const state: RunState = { taskDir: dir, identifier, runId: randomUUID(), stage: "implement", fixRounds: 0, maxFixRounds: 2, handoffRetries: 0, active: true };
      writeRun(state);
      await launch(state, ctx, (prompt) => pi.sendUserMessage(prompt, { triggerTurn: true }));
    },
  });

  pi.registerCommand("task-go-stop", {
    description: "Stop the active workflow after the current model turn",
    handler: async (_args, ctx) => {
      const state = readRun();
      if (!state?.active) { ctx.ui.notify("No active workflow.", "info"); return; }
      state.stopRequested = true;
      writeRun(state);
      if (ctx.isIdle()) finalizeRun(state, ctx, "stopped", "Stopped by the user.");
      else ctx.ui.notify("Stop requested. The report will be generated when the current turn settles.", "info");
    },
  });

  // Plain "go" belongs to the coordinator's approval conversation. It must not
  // select a globally newest task from another project/domain. Managed execution
  // starts only through /task-go with an explicit approved task identifier.

  pi.on("tool_call", async (event) => {
    const state = readRun();
    if (!state?.active) return;
    const input = typeof event.input?.command === "string" ? event.input.command : "";
    if (/\b(git\s+(commit|push|reset|clean)|gh\s+(release|repo)|glab\s+mr|npm\s+publish)\b/.test(input)) return { block: true, reason: "External repository and release actions are disabled during managed workflows." };
  });

  pi.on("message_end", async (event) => {
    const state = readRun();
    if (state?.active) recordUsage(state, event.message);
  });

  pi.on("agent_settled", async (event, ctx) => {
    const state = readRun();
    if (!state?.active) return;
    if (event.aborted || state.stopRequested) {
      finalizeRun(state, ctx, "stopped", event.aborted ? "Run aborted. No further stage was scheduled." : "Stopped by the user after the current turn.");
      return;
    }
    try { assertApprovedPlan(state.taskDir); }
    catch (error) {
      finalizeRun(state, ctx, "blocked", error instanceof Error ? error.message : String(error));
      return;
    }
    const result = brief(state.taskDir, `${stageNumber(state.stage)}-${state.stage}`);
    if (!validBrief(result, `${stageNumber(state.stage)}-${state.stage}`, state.attemptId)) {
      if (state.handoffRetries < 1) {
        state.handoffRetries += 1;
        writeRun(state);
        await launch(state, ctx, (prompt) => pi.sendUserMessage(prompt, { triggerTurn: true }));
        return;
      }
      finalizeRun(state, ctx, "blocked", `Missing valid ${state.stage} handoff after one retry.`);
      return;
    }
    state.handoffRetries = 0;
    const next = nextWorkflowStage(state.stage, state.fixRounds, state.maxFixRounds, result) as Stage | "done" | "blocked";
    if (next === "blocked") { finalizeRun(state, ctx, "blocked", "Blocking findings require a decision or the review/fix limit was reached."); return; }
    if (next === "done") { finalizeRun(state, ctx, "completed", "The managed workflow finished. Verification and acceptance are reported separately."); return; }
    if (next === "fix") state.fixRounds += 1;
    state.stage = next;
    const statusMap: Record<Stage, string> = { implement: "implementing", review: "reviewing", fix: "fixing", qa: "qa", test: "testing", audit: "auditing", finish: "finishing" };
    updateStatus(state.taskDir, statusMap[next]);
    writeRun(state);
    await launch(state, ctx, (prompt) => pi.sendUserMessage(prompt, { triggerTurn: true }));
  });
}
