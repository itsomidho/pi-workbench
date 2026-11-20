import { workbenchPaths } from "../scripts/workbench-paths.mjs";
import { domainStageContext } from "../scripts/domains.mjs";
import { requestRouterRole } from "../scripts/router-role.mjs";
import { assertApprovedPlan } from "../scripts/workflow-approval.mjs";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

function tasksRoot() {
  return workbenchPaths().tasks;
}
function standardsRootFor(domain: string) {
  return path.join(workbenchPaths().standards, domain);
}
function safePart(value: string) {
  return /^[a-z][a-z0-9-]*$/.test(value);
}
function workflowStages(domain: string) {
  return domainStageContext(domain, "plan").stages as Record<string, { status: string; role: string; report: string }>;
}
function taskDir(identifier: string) {
  const parts = identifier.split("/");
  if (parts.length !== 3 || !safePart(parts[0]) || !safePart(parts[1]) || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z][a-z0-9-]*$/.test(parts[2])) return null;
  const root = path.resolve(tasksRoot());
  const dir = path.resolve(root, parts[0], parts[1], parts[2]);
  return dir.startsWith(`${root}${path.sep}`) ? dir : null;
}
function taskFile(identifier: string) {
  const dir = taskDir(identifier);
  if (!dir || !fs.existsSync(path.join(dir, "TASK.md"))) return null;
  return { dir, file: path.join(dir, "TASK.md") };
}
function replaceField(text: string, field: string, value: string) {
  const pattern = new RegExp(`^(\\| ${field} \\| ).*?( \\|)$`, "m");
  return text.replace(pattern, `$1${value}$2`);
}
function taskComplexity(dir: string) {
  try {
    const value = JSON.parse(fs.readFileSync(path.join(dir, "artifacts", "shared-context.json"), "utf8")).complexity;
    return ["simple", "moderate", "complex"].includes(value) ? value : "moderate";
  } catch { return "moderate"; }
}
function stageContext(dir: string, currentStage?: string) {
  const artifacts = path.join(dir, "artifacts");
  const sharedFile = path.join(artifacts, "shared-context.json");
  const briefsDir = path.join(artifacts, "briefs");
  const briefs = fs.existsSync(briefsDir) ? fs.readdirSync(briefsDir).filter((file) => file.endsWith(".json")).sort() : [];
  const previous = briefs.filter((file) => !currentStage || file < `${currentStage}.json`).at(-1);
  return {
    shared: fs.existsSync(sharedFile) ? JSON.parse(fs.readFileSync(sharedFile, "utf8")) : null,
    previousBrief: previous ? JSON.parse(fs.readFileSync(path.join(briefsDir, previous), "utf8")) : null,
  };
}
const transitions: Record<string, Set<string>> = {
  planning: new Set(["awaiting-approval", "blocked"]),
  "awaiting-approval": new Set(["planning", "blocked"]),
  implementing: new Set(["reviewing", "blocked"]),
  reviewing: new Set(["fixing", "qa", "testing", "auditing", "finishing", "blocked"]),
  fixing: new Set(["reviewing", "blocked"]),
  qa: new Set(["fixing", "testing", "auditing", "finishing", "blocked"]),
  testing: new Set(["fixing", "auditing", "finishing", "blocked"]),
  auditing: new Set(["fixing", "finishing", "blocked"]),
  finishing: new Set(["done", "blocked"]),
  blocked: new Set(["planning", "awaiting-approval"]),
  done: new Set(),
};
function transition(text: string, next: string) {
  const current = text.match(/^\| Status \| (.+) \|$/m)?.[1];
  if (!current || !transitions[current]?.has(next)) throw new Error(`Invalid transition: ${current ?? "unknown"} -> ${next}`);
  return { text: replaceField(text, "Status", next), current };
}
function approvePlan(target: { dir: string; file: string }) {
  const text = fs.readFileSync(target.file, "utf8");
  const current = text.match(/^\| Status \| (.+) \|$/m)?.[1];
  if (current !== "awaiting-approval") throw new Error(`Approval requires status awaiting-approval; current status is ${current ?? "unknown"}`);
  const plan = text.match(/## Plan\n([\s\S]*?)(?=\n## |$)/)?.[1]?.trim() ?? "";
  if (!plan || /^Not approved yet\.?$/i.test(plan)) throw new Error("Cannot approve an empty or unprepared plan");
  const nextText = replaceField(text, "Status", "implementing").replace("## Decisions and constraints\n", "## Decisions and constraints\n- Plan approved by user through Pi task workflow.\n");
  const sharedFile = path.join(target.dir, "artifacts", "shared-context.json");
  if (fs.existsSync(sharedFile)) {
    const shared = JSON.parse(fs.readFileSync(sharedFile, "utf8"));
    shared.planVersion = (shared.planVersion ?? 0) + 1;
    shared.approvedPlanHash = crypto.createHash("sha256").update(plan).digest("hex");
    shared.status = "implementing";
    shared.updatedAt = new Date().toISOString();
    fs.writeFileSync(sharedFile, JSON.stringify(shared, null, 2) + "\n");
  }
  fs.writeFileSync(target.file, nextText);
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("task-init", {
    description: "Create a local domain task folder after validating project standards",
    handler: async (args, ctx) => {
      const [domain, project, slug, ...titleParts] = args.trim().split(/\s+/);
      if (!domain || !project || !slug || !titleParts.length || !safePart(domain) || !safePart(project) || !safePart(slug)) {
        ctx.ui.notify("Usage: /task-init <domain> <project> <slug> <title>", "error");
        return;
      }
      const projectFile = path.join(standardsRootFor(domain), "projects", `${project}.md`);
      if (!fs.existsSync(projectFile)) {
        ctx.ui.notify(`Missing local project standards: ${projectFile}`, "error");
        return;
      }
      const date = new Date().toISOString().slice(0, 10);
      const dir = path.join(tasksRoot(), domain, project, `${date}-${slug}`);
      if (fs.existsSync(dir)) {
        ctx.ui.notify(`Task already exists: ${dir}`, "error");
        return;
      }
      fs.mkdirSync(path.join(dir, "artifacts", "briefs"), { recursive: true });
      const task = `# Task: ${titleParts.join(" ")}\n\n| Domain | ${domain} |\n| Project | ${project} |\n| Status | planning |\n| Started | ${date} |\n| Standards | ${projectFile} |\n\n## Brief\n${titleParts.join(" ")}\n\n## Decisions and constraints\n- Pending user decisions.\n\n## Plan\nNot approved yet.\n\n## Files changed\nNone.\n\n## Open findings\nNone.\n\n## Next step\nRead the project standards and prepare the plan.\n`;
      fs.writeFileSync(path.join(dir, "TASK.md"), task);
      fs.writeFileSync(path.join(dir, "artifacts", "shared-context.json"), JSON.stringify({ schemaVersion: 1, taskId: `${domain}/${project}/${path.basename(dir)}`, domain, project, title: titleParts.join(" "), goal: titleParts.join(" "), complexity: "moderate", acceptanceCriteria: [], scope: { allowed: [], forbidden: [] }, standards: [], planVersion: 0, approvedPlanHash: null, status: "planning", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, null, 2) + "\n");
      ctx.ui.notify(`Created task: ${dir}`, "info");
    },
  });

  pi.registerCommand("task-status", {
    description: "Update a task lifecycle status",
    handler: async (args, ctx) => {
      const [identifier, status] = args.trim().split(/\s+/);
      const allowed = new Set(["planning", "awaiting-approval", "implementing", "reviewing", "fixing", "qa", "testing", "auditing", "finishing", "done", "blocked"]);
      const target = identifier && status ? taskFile(identifier) : null;
      if (!target || !allowed.has(status)) {
        ctx.ui.notify("Usage: /task-status <domain>/<project>/<date-slug> <planning|awaiting-approval|implementing|reviewing|fixing|qa|testing|auditing|finishing|done|blocked>", "error");
        return;
      }
      try {
        const result = transition(fs.readFileSync(target.file, "utf8"), status);
        fs.writeFileSync(target.file, result.text);
        ctx.ui.notify(`Task status updated: ${result.current} -> ${status}`, "info");
      } catch (error) {
        ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
      }
    },
  });

  pi.registerCommand("task-approve", {
    description: "Approve the current task plan and move it to implementation",
    handler: async (args, ctx) => {
      const target = taskFile(args.trim());
      if (!target) { ctx.ui.notify("Usage: /task-approve <domain>/<project>/<date-slug>", "error"); return; }
      try {
        approvePlan(target);
        ctx.ui.notify("Task plan approved; status is now implementing.", "info");
      } catch (error) {
        ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
      }
    },
  });

  pi.registerCommand("task-start", {
    description: "Start a named workflow stage and create its report template",
    handler: async (args, ctx) => {
      const [identifier, stage] = args.trim().split(/\s+/);
      const domain = identifier?.split("/")[0];
      const stages = domain ? workflowStages(domain) : {};
      const target = identifier && stage && stages[stage] ? taskFile(identifier) : null;
      if (!target) { ctx.ui.notify("Usage: /task-start <domain>/<project>/<date-slug> <plan|implement|review|fix|qa|test|audit|finish>", "error"); return; }
      try {
        const result = transition(fs.readFileSync(target.file, "utf8"), stages[stage].status);
        requestRouterRole(pi, domainStageContext(domain, stage).routerRole, taskComplexity(target.dir));
        fs.writeFileSync(target.file, result.text);
        const report = path.join(target.dir, `${stages[stage].report}.md`);
        if (!fs.existsSync(report)) fs.writeFileSync(report, `# ${stages[stage].report}\n\n## Objective\n\n## Findings\n\n## Evidence\n\n## Result\n\n## Next step\n`);
        ctx.ui.notify(`Started ${stage}: ${result.current} -> ${stages[stage].status}; router role: ${stages[stage].role}`, "info");
      } catch (error) {
        ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
      }
    },
  });

  pi.registerCommand("task-run", {
    description: "Run the current workflow stage through the active Pi model",
    handler: async (args, ctx) => {
      const [identifier, stage] = args.trim().split(/\s+/);
      const domain = identifier?.split("/")[0];
      const instructions: Record<string, string> = {
        plan: "Read the task and local project standards. Produce a plan only; do not edit files and do not continue until the user approves it.",
        implement: "Implement only the approved plan. Read the task, project file, and routed checklists first. Update the implementation report.",
        review: "Review the working tree against the task and standards. Findings first, with severity and file references. Do not edit files.",
        fix: "Fix only the listed approved findings. Do not expand scope. Record verification in the fix report.",
        qa: "Run the relevant browser scenarios against the local site, including console, network, RTL, mobile, and cache watch-list checks.",
        test: "Propose or write focused tests for the changed behavior, respecting the project's standards and test policy.",
        audit: "Run the relevant security/performance audit only within the approved scope and record findings.",
        finish: "Prepare the final task report, verification summary, deploy notes, and standards retrospective proposals. Do not commit or push."
      };
      const stages = domain ? workflowStages(domain) : {};
      const roles: Record<string, { status: string; role: string; report: string; instruction: string }> = Object.fromEntries(Object.entries(stages).map(([name, spec]) => [name, { ...spec, instruction: instructions[name] ?? "Read the task and follow the domain workflow." }]));
      const spec = stage ? roles[stage] : undefined;
      const target = identifier && spec ? taskFile(identifier) : null;
      if (!target) { ctx.ui.notify("Usage: /task-run <domain>/<project>/<date-slug> <plan|implement|review|fix|qa|test|audit|finish>", "error"); return; }
      const text = fs.readFileSync(target.file, "utf8");
      const current = text.match(/^\| Status \| (.+) \|$/m)?.[1];
      if (current !== spec.status) { ctx.ui.notify(`Stage ${stage} requires status ${spec.status}; current status is ${current ?? "unknown"}.`, "error"); return; }
      if (stage !== "plan") {
        try { assertApprovedPlan(target.dir); }
        catch (error) { ctx.ui.notify(error instanceof Error ? error.message : String(error), "error"); return; }
      }
      try { requestRouterRole(pi, domainStageContext(domain!, stage).routerRole, taskComplexity(target.dir)); }
      catch (error) { ctx.ui.notify(error instanceof Error ? error.message : String(error), "error"); return; }
      const context = stageContext(target.dir, spec.report);
      const prompt = `${spec.instruction}\n\nTask folder: ${target.dir}\nLive context: ${target.file}\nStage report: ${path.join(target.dir, `${spec.report}.md`)}\nStage handoff brief: ${path.join(target.dir, "artifacts", "briefs", `${spec.report}.json`)}\nShared task context (JSON):\n${JSON.stringify(context.shared)}\nDirect previous-stage brief (JSON):\n${JSON.stringify(context.previousBrief)}\n\nUse only the shared context, the direct previous brief, and relevant evidence. Do not read unrelated reports or the full conversation unless required to verify evidence. You own only this stage. Read the live context first, follow the portable workflow, and report evidence. Do not commit, push, post, or perform out-of-scope work.`;
      const domainContext = domainStageContext(domain!, stage);
      pi.sendUserMessage(`${prompt}\n\n${domainContext.text}`, { triggerTurn: true, expandPromptTemplates: false });
      ctx.ui.notify(`Started model run for ${stage} using role ${spec.role}.`, "info");
    },
  });

  pi.registerCommand("task-report", {
    description: "Add a numbered workflow report to a task",
    handler: async (args, ctx) => {
      const [identifier, step, ...summaryParts] = args.trim().split(/\s+/);
      const target = identifier && step && summaryParts.length ? taskFile(identifier) : null;
      if (!target || !/^\d{2}-[a-z][a-z0-9-]*$/.test(step)) {
        ctx.ui.notify("Usage: /task-report <domain>/<project>/<date-slug> <NN-step> <summary>", "error");
        return;
      }
      const report = path.join(target.dir, `${step}.md`);
      if (fs.existsSync(report)) { ctx.ui.notify(`Report already exists: ${report}`, "error"); return; }
      fs.writeFileSync(report, `# ${step}\n\n${summaryParts.join(" ")}\n\n## Evidence\n- Add commands, files, findings, and verification here.\n`);
      ctx.ui.notify(`Created report: ${report}`, "info");
    },
  });

  pi.registerCommand("task-list", {
    description: "List local domain task folders",
    handler: async (_args, ctx) => {
      const root = tasksRoot();
      if (!fs.existsSync(root)) { ctx.ui.notify("No Pi task workspace exists.", "info"); return; }
      const rows: string[] = [];
      for (const domain of fs.readdirSync(root).sort()) {
        const domainDir = path.join(root, domain);
        if (!fs.statSync(domainDir).isDirectory()) continue;
        for (const project of fs.readdirSync(domainDir).sort()) {
          const projectDir = path.join(domainDir, project);
          if (!fs.statSync(projectDir).isDirectory()) continue;
          for (const task of fs.readdirSync(projectDir).sort()) {
          const file = path.join(projectDir, task, "TASK.md");
          if (!fs.existsSync(file)) continue;
          const text = fs.readFileSync(file, "utf8");
          const status = text.match(/^\| Status \| (.+) \|$/m)?.[1] ?? "unknown";
          rows.push(`${domain}/${project}/${task}: ${status}`);
          }
        }
      }
      ctx.ui.notify(rows.length ? rows.join("\n") : "No tasks found.", "info");
    },
  });
}
