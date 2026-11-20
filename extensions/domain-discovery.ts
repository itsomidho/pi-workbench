import { workbenchPaths } from "../scripts/workbench-paths.mjs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import path from "node:path";
import { configRoot, discoverDomains, detectDomain } from "../scripts/domains.mjs";
import { findProjectStandards, localStandardsRoot } from "../scripts/project-standards.mjs";

export default function (pi: ExtensionAPI) {
  // Domain manifests are the registry. Adding a valid pack needs no package.json edits.
  pi.on("resources_discover", () => {
    const { domains, errors } = discoverDomains();
    for (const error of errors) console.error(`Domain ${error.domain} disabled: ${error.error}`);
    return { skillPaths: domains.flatMap(domain => domain.skillPaths) };
  });
  pi.on("before_agent_start", (event, ctx) => {
    if (!/# Think workflow for Pi|# \/think:|# Development workflow for Pi/.test(event.prompt)) return;
    try {
      const result = detectDomain(ctx.cwd);
      const projects = result.selected ? findProjectStandards(ctx.cwd, result.selected) : null;
      return { message: {
        customType: "workbench-domain-discovery", display: false,
        content: `Workbench root: ${configRoot()}\nThink protocol: ${path.join(configRoot(), "skills/think/SKILL.md")}\nEffective local standards root: ${localStandardsRoot()}\nEffective task workspace: ${workbenchPaths().tasks}\nEffective Think notes root: ${workbenchPaths().think}\nRead-only local project standards discovery: ${JSON.stringify(projects)}\nRead the selected project file in full before asking for initialization. Ambiguous/unconfirmed matches require clarification; a partial scan or unknown path is not proof that standards are absent. Do not infer passed checks from test source or command names.\nRead-only domain discovery (evidence, not execution approval):\n${JSON.stringify(result)}\nIf ambiguous, unconfirmed, or unsupported, clarify the affected component or propose a main-session fallback. Do not default to WordPress. Request words may guide investigation but do not override repository evidence. Read the selected route entry before proposing execution.`,
      } };
    } catch (error) {
      return { message: { customType: "workbench-domain-discovery", display: false, content: `Domain discovery unavailable: ${error instanceof Error ? error.message : String(error)}. Do not invent a domain workflow; investigate or propose a main-session plan.` } };
    }
  });
}
