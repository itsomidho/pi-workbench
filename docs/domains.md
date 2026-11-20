# Domain packs and Think routing

## The flow

```text
/think <request>                   generic conversation/approval protocol
  → discover domains/*/domain.json
  → inspect the affected repository/component
  → confirm a domain and operation
  → read that manifest's route entry
  → recommend a plan, wait for approval
  → execute the selected route using its declared engine
```

`/development <request>` is a generic development prompt that does the same domain selection without the extended Think discussion. It still requires plan approval. It is not the WordPress playbook.

`/skill:wordpress-development` loads WordPress's detailed playbook directly. The skill used to be named `development`; the new name avoids collisions with future packs. `/development` remains available as the generic entry point.

The responsibilities are separate:

- `workflows/think.md`: Pi prompt entry point, expanded by Pi, not a program that launches agents.
- `skills/think/SKILL.md`: conversation, evidence, approval, and routing protocol.
- `domains/<id>/domain.json`: discovery, detection, resources, operation-to-workflow mapping.
- A route's `SKILL.md`: the domain-specific playbook.
- A route's `workflow.json`: stage metadata for the supported managed engine.
- `extensions/domain-discovery.ts`: loads valid pack skills on startup/reload and supplies repository detection context to Think/development entry points.
- `scripts/domains.mjs`: shared validation, detection, and stage-context loading.

## Inspect the installation

```bash
piw domain list
piw domain check
piw domain detect /absolute/path/to/repository-or-component
```

Commands are read-only and output JSON. `list` and `check` exit nonzero when packs are invalid. Detection outputs `matched`, `ambiguous`, `unconfirmed` (a match plus validation/detection errors), or `unsupported`. Only `matched` supplies `selected`. No domain is the default.

Detection inspects the exact directory supplied, not all parents or every nested dependency. For multi-stack repositories, inspect the affected component explicitly. If multiple domains match, Think must clarify the component, not choose the first or highest-scoring match. Request wording is a hint; a new/empty project needs user confirmation of its intended stack. A task-specific match does not authorize execution.

Defaults:

- Packs: the Workbench installation's `domains/`; override the application root with `PI_CONFIG_DIR`.
- Local standards: `$HOME/.config/pi-workbench/standards/<domain>/projects/`; override the standards root with `PI_STANDARDS_DIR`.
- Tasks: `$HOME/.local/state/pi-workbench/tasks/<domain>/<project>/`; override with `PI_TASKS_DIR`.

## Local project standards discovery

Think/development injection also reports the effective `PI_STANDARDS_DIR` root (default `$HOME/.config/pi-workbench/standards`) and a bounded project match for the confirmed domain. It inspects explicit repository/local-path identity fields in Markdown table rows or template bullet fields, not filenames or incidental mentions. `~/` expands against the current home directory; canonical paths match symlink aliases and components inside an explicitly declared repository, never similarly named sibling paths. Historical paths in trailing notes are not selected as the current identity.

A unique match supplies an exact file path; read that file in full before proposing setup or execution. Multiple matches are ambiguous. Unsafe/unavailable files, escaping symlinks, oversized files (over 1 MiB), or a partial scan (over 250 Markdown files) make discovery unconfirmed and must not imply that project standards are absent. No directories or project files are created by discovery. Nonstandard Markdown identity formats and remote-only standards still need manual inspection/confirmation. Framework/domain detection and project-path matching are evidence, not execution approval.

## Bundled packs

| Domain | Detection at the component directory | Development skill |
|---|---|---|
| WordPress | WordPress files, Sage dependency, or Bedrock layout | wordpress-development |
| Laravel | artisan plus laravel/framework in composer.json | laravel-development |
| Django | manage.py containing django.core.management | django-development |
| Next.js | next in package.json dependencies or devDependencies | nextjs-development |
| Nuxt | nuxt in package.json dependencies or devDependencies | nuxt-development |

Each pack includes a guide, project template, baseline checklists, quality-gate guidance, stage role profiles, and the managed development stage contract. New packs do not yet expose merge-request-review routes; use a disclosed, approved main-session fallback for unsupported operations. Nonstandard layouts need explicit component selection and confirmation rather than a guessed match.

Framework commands are examples, not automatically executed gates. Confirm project versions, environment/virtualenv/container, and disposable test databases before running them. Real application and skill-behavior evaluation remains necessary before relying on these baselines in production.

### Next.js and Nuxt

React/Vue dependencies alone, config filenames, peerDependencies, or script names do not select these domains. A component declaring both next and nuxt is ambiguous. In a monorepo, detect the actual application directory; do not scan dependencies or choose a framework from the workspace root by guesswork.

Both packs require version and deployment-target confirmation. The Next.js guide separates App/Pages Router, Server/Client Components, Server Actions/route-handler authorization, request-specific caches, and static/Edge/Node constraints. The Nuxt guide covers major-version/layout differences, SSR composable/state isolation, hydration, Nitro/H3 server authorization where applicable, runtimeConfig exposure, and rendering/deployment rules. Neither guide assumes latest framework APIs or installs optional test tools automatically.

Configure a real project only when requested:

```bash
piw domain detect /path/to/application
piw init nextjs my-next-app
# OR
piw init nuxt my-nuxt-app
```

Fill the generated project template with actual versions, package manager, router/layout, safe test services, scripts, local URL, and deployment target. Reload Pi, then use `/think <task>` or `/development <task>`. Direct playbook commands are `/skill:nextjs-development` and `/skill:nuxt-development`.

Before release, smoke-test representative applications with their existing tooling: direct SSR URL reload plus client navigation, loading/error states, hydration warnings, denied/authorized server requests, and cross-user cache/payload isolation. Build/prerender commands can contact services; confirm safe settings first. The current pack tests validate detection, project-template initialization, real Pi skill advertisement, and mock-model orchestration, not real framework behavior or an independent skill-quality benchmark. No suitable Next.js/Nuxt applications were found locally during this implementation, so application smoke tests remain pending.

## Add a domain

There is no domain scaffold command yet. Create a pack manually under `domains/<id>/` in the Workbench application:

```text
domains/example/
├── domain.json
├── quality-gates.json
├── roles/
├── skills/
│   └── example-guide/SKILL.md
├── standards/
│   ├── README.md
│   ├── checklists/INDEX.md
│   ├── checklists/security.md
│   └── projects/PROJECT.template.md
└── workflows/
    └── development/SKILL.md
```

Start with a main-session route; add managed-stage support only when its playbook, roles, and gates are ready. Example manifest (illustrative pack, not an installed framework):

```json
{
  "schemaVersion": 1,
  "id": "example",
  "name": "Example framework",
  "roles": "./roles",
  "skills": "./skills",
  "standards": "./standards",
  "workflows": "./workflows",
  "qualityGates": "./quality-gates.json",
  "detection": {
    "any": [
      {
        "all": [
          { "path": "framework-cli" },
          { "path": "composer.json", "jsonDependency": "example/framework" }
        ]
      }
    ]
  },
  "routes": {
    "development": {
      "entry": "./workflows/development/SKILL.md",
      "engine": "main-session"
    }
  }
}
```

Requirements:

1. Use a lowercase, hyphen-separated domain ID matching its directory.
2. All resource and route paths must exist and stay inside the pack, including after symlink resolution. The project template and a valid JSON quality-gates file are required. Packs are trusted application instructions: review them before installation.
3. Detection `any` is a list of alternatives; each alternative's `all` signals must match. `path` is an exact relative file/directory path, not a glob. `jsonDependency` optionally checks a dependency key in `require`, `require-dev`, `dependencies`, or `devDependencies`. `contains` optionally checks a non-empty literal substring (maximum 4096 characters), not an executable expression or regex. When both are present, both must match. The checker does not run repository code, follow external repository symlinks, or inspect content/dependency files larger than 1 MiB.
4. Use strong signals. For example, Laravel can use `artisan` plus `composer.json` containing `laravel/framework`. The Django pack checks that `manage.py` contains `django.core.management`; a file named manage.py alone is not sufficient. Do not use `roots/acorn` alone to identify Laravel: it is also used by WordPress.
5. Every `SKILL.md` needs Pi frontmatter with a name and non-empty description (single-line or indented folded/literal block), and a globally unique name. Prefer `example-development`, not `development`. Names shared with another pack or core Think skills fail validation. Do not place reference documents named `SKILL.md` unless they are intended to be advertised as skills.
6. Add operation routes such as `merge-request-review` only if the pack actually supports them. Missing routes require a disclosed main-session fallback; they never silently reuse another domain.

Then:

```bash
piw domain check
piw domain detect /path/to/example-project
piw init example my-project
```

Fill in the generated local project configuration (repository path, scope, versions, test/build commands, branch conventions). Then run `/reload` in Pi. The extension discovers the pack and its skills; no changes to Think or `package.json` are required. If the extension is disabled or package resource filters exclude it, automatic discovery is unavailable; the read-only CLI still works.

Test `/think <a real task>` inside the repository. Confirm the reported domain, evidence, exact route, and execution method before saying `go`.

## Managed execution contract

Currently supported engines:

- `main-session`: follow the selected playbook with available tools after approval. No automatic stage loop.
- `managed-development-v1`: the existing bounded development stage loop. This is **not** a general workflow graph engine.

For the managed engine, add `stages` to `routes.development`:

```json
{
  "entry": "./workflows/development/SKILL.md",
  "engine": "managed-development-v1",
  "stages": "./workflows/development/workflow.json"
}
```

Use this exact stage/status/report contract:

| Stage | Status | Report |
|---|---|---|
| plan | awaiting-approval | 01-plan |
| implement | implementing | 02-implement |
| review | reviewing | 03-review |
| fix | fixing | 04-fix |
| qa | qa | 05-qa |
| test | testing | 06-test |
| audit | auditing | 07-audit |
| finish | finishing | 08-finish |

Each stage in `workflow.json` specifies `status`, `report`, and `role`. The corresponding `<roles-directory>/<role>.md` must exist. Use the WordPress `workflow.json` as a structural example, but write your own domain instructions. Custom stage graphs/statuses are rejected rather than pretending they are executable.

The runtime reads the chosen domain role instructions and includes its workflow, standards, skills, and quality-gate paths in each stage prompt. Stage names map to the generic model-router profiles; domain role filenames may differ. Role updates use the registered router's acknowledged session event bus, not mutable cross-extension imports; keep the model-router extension enabled for managed execution. `/task-go <domain>/<project>/<date-slug>` starts at implement after a prepared plan has been approved. It retains bounded review/fix loops and handoff requirements. Plain `go` remains a coordinator approval message; it no longer auto-selects the globally newest task from an unrelated domain/project. The coordinator must use the explicit task identifier.

**Execution limitation:** current managed stages run through the current session, not independent agents. Role instructions, router capabilities, and `tools: false` are not enforced permission boundaries. Think's advisor still requires verified read-only/tool-less delegation or the explicit coordinator-only fallback. Quality-gate files are supplied as guidance; the loader does not automatically execute arbitrary commands from them.

Every execution entry and continuation rechecks the approved plan record. Changed/missing approval records or non-executable task states block execution; legacy tasks without approval metadata must be explicitly approved again. Aborted runs pause rather than schedule another stage. Handoffs are bound to the current attempt, so a previous run or retry cannot silently satisfy a new stage. QA, test, audit, or finish blocking findings pause for a user decision instead of marking the task complete. Re-review uses the fix handoff, and QA receives the last review even when the fix stage was skipped.

No commits, pushes, publishing, or merge requests are authorized by domain detection or plan approval.

## Validation and upgrades

```bash
npm run check
npm test
```

Tests also verify real Pi skill advertisement (including YAML parsing) and shared-skill exclusion. Domain tests cover WordPress, Laravel, Django, Next.js, Nuxt, and a synthetic extension domain: reload discovery, ambiguous and unsupported projects, broken manifests, missing/escaping paths, skill metadata, dependency/content evidence, approval checks, stage progression, and real Pi RPC execution with a mock model for all five bundled domains and the synthetic extension. They verify plumbing, not the quality of a real model's domain judgments.

Existing custom manifests must add `detection` and `routes` before this loader will enable them. The added framework packs are baseline playbooks and standards, not application installations; they do not install PHP/Python/JavaScript dependencies or provide project-specific facts. Keep custom packs backed up: they live in the Workbench application directory, and release updates may replace application files.
