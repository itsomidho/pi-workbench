import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Type } from "typebox";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

type Stage = "implement" | "review" | "fix" | "qa" | "test" | "audit" | "finish";
type RunState = { taskDir: string; identifier: string; stage: Stage; fixRounds: number; maxFixRounds: number; handoffRetries: number; active: boolean };
const stages: Stage[] = ["implement", "review", "fix", "qa", "test", "audit", "finish"];

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
function latestApprovedTask() {
  const root = path.resolve(tasksRoot());
  let candidate: { identifier: string; taskDir: string; mtime: number } | null = null;
  if (!fs.existsSync(root)) return null;
  for (const domainEntry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!domainEntry.isDirectory()) continue;
    const domain = domainEntry.name;
    for (const project of fs.readdirSync(path.join(root, domain), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name)) {
    const projectDir = path.join(root, domain, project);
    for (const task of fs.readdirSync(projectDir)) {
      const dir = path.join(projectDir, task);
      if (!fs.existsSync(statusFile(dir)) || status(dir) !== "implementing") continue;
      const item = { identifier: `${domain}/${project}/${task}`, taskDir: dir, mtime: fs.statSync(statusFile(dir)).mtimeMs };
      if (!candidate || item.mtime > candidate.mtime) candidate = item;
    }
    }
  }
  return candidate;
}
function writeRun(state: RunState) {
  fs.mkdirSync(tasksRoot(), { recursive: true });
  fs.writeFileSync(runFile(), JSON.stringify(state, null, 2) + "\n");
  const stateFile = path.join(state.taskDir, "artifacts", "state.json");
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  const current = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, "utf8")) : { schemaVersion: 1 };
  fs.writeFileSync(stateFile, JSON.stringify({ ...current, stage: state.stage, fixRounds: state.fixRounds, maxFixRounds: state.maxFixRounds, active: state.active, updatedAt: new Date().toISOString() }, null, 2) + "\n");
}
function recordUsage(dir: string, message: any) {
  if (message?.role !== "assistant" || !message.usage) return;
  const file = path.join(dir, "artifacts", "usage.jsonl");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify({ timestamp: new Date().toISOString(), model: message.model, usage: message.usage }) + "\n");
}
function statusFile(dir: string) { return path.join(dir, "TASK.md"); }
function status(dir: string) { return fs.readFileSync(statusFile(dir), "utf8").match(/^\| Status \| (.+) \|$/m)?.[1]; }
function approveLatestTask() {
  const root = path.resolve(tasksRoot());
  let candidate: { taskDir: string; identifier: string; mtime: number } | null = null;
  if (!fs.existsSync(root)) return null;
  for (const domainEntry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!domainEntry.isDirectory()) continue;
    const domain = domainEntry.name;
    for (const projectEntry of fs.readdirSync(path.join(root, domain), { withFileTypes: true })) {
      if (!projectEntry.isDirectory()) continue;
      const project = projectEntry.name;
      for (const task of fs.readdirSync(path.join(root, domain, project))) {
        const dir = path.join(root, domain, project, task);
        if (status(dir) !== "awaiting-approval") continue;
        const file = statusFile(dir);
        const item = { taskDir: dir, identifier: `${domain}/${project}/${task}`, mtime: fs.statSync(file).mtimeMs };
        if (!candidate || item.mtime > candidate.mtime) candidate = item;
      }
    }
  }
  return candidate;
}
function approveTask(dir: string) {
  const file = statusFile(dir);
  const text = fs.readFileSync(file, "utf8");
  const plan = text.match(/## Plan\n([\s\S]*?)(?=\n## |$)/)?.[1]?.trim() ?? "";
  if (!plan || /^Not approved yet\.?$/i.test(plan)) throw new Error("Cannot approve an empty or unprepared plan");
  fs.writeFileSync(file, text.replace(/^(\| Status \| ).*?( \|)$/m, "$1implementing$2").replace("## Decisions and constraints\n", "## Decisions and constraints\n- Plan approved by user through Pi task workflow.\n"));
  const sharedFile = path.join(dir, "artifacts", "shared-context.json");
  if (fs.existsSync(sharedFile)) {
    const shared = JSON.parse(fs.readFileSync(sharedFile, "utf8"));
    shared.planVersion = (shared.planVersion ?? 0) + 1;
    shared.approvedPlanHash = crypto.createHash("sha256").update(plan).digest("hex");
    shared.status = "implementing";
    shared.updatedAt = new Date().toISOString();
    fs.writeFileSync(sharedFile, JSON.stringify(shared, null, 2) + "\n");
  }
}
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
function planHash(dir: string) {
  const text = fs.readFileSync(statusFile(dir), "utf8");
  const plan = text.match(/## Plan\n([\s\S]*?)(?=\n## |$)/)?.[1]?.trim() ?? "";
  return crypto.createHash("sha256").update(plan).digest("hex");
}
function brief(dir: string, stage: string): any | null {
  const file = path.join(dir, "artifacts", "briefs", `${stage}.json`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
}
function writeBrief(dir: string, stage: string, input: any) {
  const file = path.join(dir, "artifacts", "briefs", `${stage}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const value = { schemaVersion: 1, stage, status: "completed", summary: input.summary, changedFiles: input.changedFiles ?? [], findings: input.findings ?? [], commandsRun: input.commandsRun ?? [], knownRisks: input.knownRisks ?? [], nextChecks: input.nextChecks ?? [], evidence: input.evidence ?? [], createdAt: new Date().toISOString() };
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
  return value;
}
function validBrief(value: any, expectedStage: string) {
  return value?.schemaVersion === 1 && value.stage === expectedStage && value.status === "completed" && typeof value.summary === "string" && ["changedFiles", "findings", "commandsRun", "knownRisks", "nextChecks", "evidence"].every((key) => Array.isArray(value[key]));
}
function writeFinalReport(state: RunState) {
  const briefsDir = path.join(state.taskDir, "artifacts", "briefs");
  const briefs = fs.existsSync(briefsDir) ? fs.readdirSync(briefsDir).filter((file) => file.endsWith(".json")).sort().map((file) => JSON.parse(fs.readFileSync(path.join(briefsDir, file), "utf8"))) : [];
  const usageFile = path.join(state.taskDir, "artifacts", "usage.jsonl");
  const usage = fs.existsSync(usageFile) ? fs.readFileSync(usageFile, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line)) : [];
  const totals = usage.reduce((sum, item) => { const u = item.usage ?? {}; sum.input += Number(u.input ?? u.inputTokens ?? 0); sum.output += Number(u.output ?? u.outputTokens ?? 0); sum.cost += Number(u.cost?.total ?? u.cost ?? 0); return sum; }, { input: 0, output: 0, cost: 0 });
  const lines = [`# Final Workflow Report`, ``, `- Task: ${state.identifier}`, `- Fix rounds: ${state.fixRounds}/${state.maxFixRounds}`, `- Completed: ${new Date().toISOString()}`, ``, `## Stage summaries`, ...briefs.map((item) => `- **${item.stage}**: ${item.summary}`), ``, `## Findings`, ...briefs.flatMap((item) => (item.findings ?? []).map((finding: any) => `- [${finding.severity ?? "info"}] ${finding.summary ?? JSON.stringify(finding)}`)), ``, `## Usage`, `- Model responses: ${usage.length}`, `- Input tokens: ${totals.input}`, `- Output tokens: ${totals.output}`, `- Reported cost: ${totals.cost}`];
  fs.writeFileSync(path.join(state.taskDir, "FINAL.md"), lines.join("\n") + "\n");
}
function promptFor(state: RunState, context: any) {
  const instructions: Record<Stage, string> = {
    implement: "Implement only the approved plan. Do not expand scope.",
    review: "Review the implementation against the task, plan, standards, and diff. Record every finding with id, severity, file, line, summary, blocking, and evidence.",
    fix: "Fix only the blocking findings from the previous review. Do not expand scope. Re-run focused verification.",
    qa: "Run relevant user-facing QA scenarios and record evidence, including console, network, responsive, accessibility, and cache checks when applicable.",
    test: "Run or add focused tests for the changed behavior. Prefer deterministic commands and record their results.",
    audit: "Run the relevant security and quality audits within the approved scope. Record findings and evidence.",
    finish: "Prepare the final report from the shared context and stage briefs. Do not commit, push, publish, or open a merge request.",
  };
  const handoffRetry = state.handoffRetries > 0 ? "The previous response did not create a valid handoff. Call workflow_handoff now with the evidence already collected." : "";
  return `${handoffRetry}\n${instructions[state.stage]}\n\nTask directory: ${state.taskDir}\nShared context: ${path.join(state.taskDir, "artifacts/shared-context.json")}\nPrevious brief: ${JSON.stringify(context)}\nExpected handoff stage: ${stageNumber(state.stage)}-${state.stage}\nHandoff brief path: ${path.join(state.taskDir, "artifacts", "briefs", `${stageNumber(state.stage)}-${state.stage}.json`)}\nWrite the human report and call the workflow_handoff tool with the completed summary and evidence. Stop and request user input for destructive actions, missing access, unresolved scope, or repeated failure.`;
}
function stageNumber(stage: Stage) { return String(stages.indexOf(stage) + 2).padStart(2, "0"); }
function previousBrief(state: RunState) {
  const index = stages.indexOf(state.stage);
  if (index <= 0) return null;
  const previous = stages[index - 1];
  return brief(state.taskDir, `${stageNumber(previous)}-${previous}`);
}
function nextStage(state: RunState, result: any): Stage | "done" | "blocked" {
  if (state.stage === "review") {
    const findings = Array.isArray(result?.findings) ? result.findings : [];
    if (findings.some((item: any) => item?.blocking !== false && ["critical", "high", "medium"].includes(item?.severity))) return state.fixRounds < state.maxFixRounds ? "fix" : "blocked";
    return "qa";
  }
  if (state.stage === "fix") return "review";
  const index = stages.indexOf(state.stage);
  return stages[index + 1] ?? "done";
}
async function launch(state: RunState, ctx: ExtensionContext, send: (prompt: string) => void | Promise<void>) {
  const previous = previousBrief(state);
  process.env.PI_ROUTER_ROLE = ({ implement: "developer", review: "code-reviewer", fix: "developer", qa: "qa", test: "test-writer", audit: "security-auditor", finish: "developer" } as Record<Stage, string>)[state.stage];
  ctx.ui.notify(`Workflow stage: ${state.stage} (${process.env.PI_ROUTER_ROLE})`, "info");
  await send(promptFor(state, previous));
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "workflow_handoff",
    label: "Workflow handoff",
    description: "Write the compact, structured handoff brief for the currently running workflow stage.",
    parameters: Type.Object({
      stage: Type.String({ description: "Expected stage brief filename, for example 02-implement or 03-review" }),
      summary: Type.String(),
      changedFiles: Type.Optional(Type.Array(Type.String())),
      findings: Type.Optional(Type.Array(Type.Any())),
      commandsRun: Type.Optional(Type.Array(Type.Any())),
      knownRisks: Type.Optional(Type.Array(Type.Any())),
      nextChecks: Type.Optional(Type.Array(Type.Any())),
      evidence: Type.Optional(Type.Array(Type.Any())),
    }),
    async execute(_toolCallId, params) {
      const state = readRun();
      if (!state?.active) return { content: [{ type: "text", text: "No active workflow." }], details: {} };
      const expected = `${stageNumber(state.stage)}-${state.stage}`;
      if (params.stage !== expected) return { content: [{ type: "text", text: `Expected handoff stage ${expected}.` }], details: {} };
      const value = writeBrief(state.taskDir, expected, params);
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
      const sharedFile = path.join(dir, "artifacts", "shared-context.json");
      if (fs.existsSync(sharedFile)) {
        const shared = JSON.parse(fs.readFileSync(sharedFile, "utf8"));
        if (shared.approvedPlanHash && shared.approvedPlanHash !== planHash(dir)) { ctx.ui.notify("Workflow blocked: the approved plan changed and requires approval again.", "error"); return; }
      }
      const existing = readRun();
      if (existing?.active && existing.identifier !== identifier) { ctx.ui.notify(`Another workflow is active: ${existing.identifier}`, "error"); return; }
      const state: RunState = { taskDir: dir, identifier, stage: "implement", fixRounds: 0, maxFixRounds: 2, handoffRetries: 0, active: true };
      writeRun(state);
      await launch(state, ctx, (prompt) => pi.sendUserMessage(prompt, { triggerTurn: true }));
    },
  });

  pi.registerCommand("task-go-stop", {
    description: "Stop the active workflow after the current model turn",
    handler: async (_args, ctx) => {
      const state = readRun();
      if (!state?.active) { ctx.ui.notify("No active workflow.", "info"); return; }
      state.active = false; writeRun(state); ctx.ui.notify("Workflow will stop after the current stage.", "info");
    },
  });

  pi.on("input", async (event, ctx) => {
    if (event.source === "extension" || event.text.trim().toLowerCase() !== "go") return { action: "continue" as const };
    const active = readRun();
    if (active?.active) return { action: "handled" as const };
    const awaiting = approveLatestTask();
    const approved = awaiting ? awaiting : latestApprovedTask();
    if (!approved) return { action: "continue" as const };
    const state: RunState = { taskDir: approved.taskDir, identifier: approved.identifier, stage: "implement", fixRounds: 0, maxFixRounds: 2, handoffRetries: 0, active: true };
    writeRun(state);
    await launch(state, ctx, (prompt) => pi.sendUserMessage(prompt, { triggerTurn: true }));
    return { action: "handled" as const };
  });

  pi.on("tool_call", async (event) => {
    const state = readRun();
    if (!state?.active) return;
    const input = typeof event.input?.command === "string" ? event.input.command : "";
    if (/\b(git\s+(commit|push|reset|clean)|gh\s+(release|repo)|glab\s+mr|npm\s+publish)\b/.test(input)) return { block: true, reason: "External repository and release actions are disabled during managed workflows." };
  });

  pi.on("message_end", async (event) => {
    const state = readRun();
    if (state?.active) recordUsage(state.taskDir, event.message);
  });

  pi.on("agent_settled", async (_event, ctx) => {
    const state = readRun();
    if (!state?.active) return;
    const result = brief(state.taskDir, `${stageNumber(state.stage)}-${state.stage}`);
    if (!validBrief(result, `${stageNumber(state.stage)}-${state.stage}`)) {
      if (state.handoffRetries < 1) {
        state.handoffRetries += 1;
        writeRun(state);
        await launch(state, ctx, (prompt) => pi.sendUserMessage(prompt, { triggerTurn: true }));
        return;
      }
      state.active = false;
      writeRun(state);
      ctx.ui.notify(`Workflow paused: missing valid ${state.stage} handoff brief after retry.`, "warning");
      return;
    }
    state.handoffRetries = 0;
    const next = nextStage(state, result);
    if (next === "blocked") { state.active = false; writeRun(state); updateStatus(state.taskDir, "blocked"); ctx.ui.notify("Workflow paused: maximum review/fix rounds reached.", "warning"); return; }
    if (next === "done") { state.active = false; writeRun(state); updateStatus(state.taskDir, "done"); writeFinalReport(state); ctx.ui.notify("Workflow completed.", "info"); return; }
    if (next === "fix") state.fixRounds += 1;
    state.stage = next;
    const statusMap: Record<Stage, string> = { implement: "implementing", review: "reviewing", fix: "fixing", qa: "qa", test: "testing", audit: "auditing", finish: "finishing" };
    updateStatus(state.taskDir, statusMap[next]);
    writeRun(state);
    await launch(state, ctx, (prompt) => pi.sendUserMessage(prompt, { triggerTurn: true }));
  });
}
