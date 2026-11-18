import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import path from "node:path";
import { configRoot, discoverDomains, detectDomain } from "../scripts/domains.mjs";

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
      return { message: {
        customType: "workbench-domain-discovery", display: false,
        content: `Workbench root: ${configRoot()}\nThink protocol: ${path.join(configRoot(), "skills/think/SKILL.md")}\nRead-only domain discovery (evidence, not execution approval):\n${JSON.stringify(result)}\nIf ambiguous, unconfirmed, or unsupported, clarify the affected component or propose a main-session fallback. Do not default to WordPress. Request words may guide investigation but do not override repository evidence. Read the selected route entry before proposing execution.`,
      } };
    } catch (error) {
      return { message: { customType: "workbench-domain-discovery", display: false, content: `Domain discovery unavailable: ${error instanceof Error ? error.message : String(error)}. Do not invent a domain workflow; investigate or propose a main-session plan.` } };
    }
  });
}
