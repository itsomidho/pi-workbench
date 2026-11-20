# Model router

Pi Workbench provides the virtual model `router/auto`. It selects a physical model from Pi's currently available providers and adapters.

## Workbench commands

| Command | Purpose |
| --- | --- |
| `piw run [Pi arguments…]` | Start Pi in the current project using `router/auto` by default. |
| `piw run --models 'provider/model-a,provider/model-b'` | Limit the models available in this session. |
| `piw run --model provider/model-id` | Select one physical model directly. |
| `piw run --list-models [search]` | List available models and exit. |
| `piw model-capabilities init [path] [--force]` | Create a policy interactively and print the saved JSON. To replace a file, specify its path before `--force`. |
| `piw model-capabilities list [path]` | Display saved models and stage allowlists. |
| `piw model-capabilities validate [path]` | Check policy structure without contacting providers. |
| `piw model-capabilities help` | Print policy command help. |
| `/router-role <role> [complexity]` | Set routing requirements for the next routed request. |
| `/router-status` | Show the active role, selection, and last physical response model. |

## Normal usage

```fish
cd "$HOME/projects/my-project"
piw run
```

`piw run` starts Pi with `router/auto` unless a model is explicitly provided. It loads all configured provider env files so dynamic adapter catalogs can be discovered.

List the catalog first:

```fish
piw run --list-models
```

Run one known model directly:

```fish
# Replace provider-a/model-id with an exact catalog entry.
piw run --model provider-a/model-id
```

## Role requirements

Set a role when a stage needs a capability profile:

```fish
PI_ROUTER_ROLE=planner piw run
PI_ROUTER_ROLE=debugger piw run
PI_ROUTER_ROLE=code-reviewer piw run
PI_ROUTER_ROLE=qa piw run
```

`PI_ROUTER_ROLE` initializes the role when the extension loads. An explicit `/router-role <role>` command overrides that initial role for the current runtime; it does not rewrite the environment. Reloading starts from the environment again. Unknown roles fail explicitly rather than silently selecting the default.

Inside Pi:

```text
/router-role think
/router-status
```

The role applies to the next user request using `router/auto`; it does not reroute an already running request or a directly selected physical model. Status distinguishes the effective role's base requirements, selected model, and the last physical response model on the current branch. That last response is historical evidence, not a prediction for the next request; prompt inference can add reasoning to the base profile.

Roles are capability hints, not provider/model aliases or tool permissions. In particular, `think-advisor` does not create a delegated agent, and `tools: false` does not disable tools. Delegate only through a verified read-only or tool-less execution boundary; otherwise disclose coordinator-only analysis. Set the advisor role in the delegated runtime, not in the coordinator. The router considers work capability, task complexity, tools, reasoning, vision, and context window. Set complexity explicitly when needed: `/router-role developer complex` or `PI_ROUTER_COMPLEXITY=complex`. For durable managed tasks, Think records `simple`, `moderate`, or `complex` in shared task context and each stage applies it automatically. A model may be visible in the catalog but rejected for a role if its metadata does not satisfy the role.

## Requests from other extensions

Use `requestRouterRole(pi, role, complexity)` from `scripts/router-role.mjs`. It emits a session event-bus request to the registered model-router and requires an acknowledgement of the effective role and complexity. Do not import and mutate the router module's state from another extension: Pi isolates extension imports, so that may change a separate instance while the registered router keeps its old role.

Managed stages fail clearly when the model-router extension is disabled or cannot confirm the update. Confirmation establishes the requested capability profile only; it does not prove physical dispatch, select router/auto for a directly selected physical model, or enforce tool permissions. The real Pi integration tests verify that `/router-status` observes the orchestrator's role update across registered extensions.

## Capability policy

Manage the interactive policy with the complete command family:

```fish
piw model-capabilities init [path]
piw model-capabilities list [path]
piw model-capabilities validate [path]
```

`init` creates the policy interactively and prints the exact JSON it saved under **Saved policy**. `list` displays configured models and stage allowlists, and `validate` checks the file. The default path is `$HOME/.config/pi-workbench/model-capabilities.json`; use `PI_MODEL_CAPABILITIES_FILE` or an explicit path to select another file. The initializer never contacts providers or reads credentials. It accepts vendor-neutral provider/model IDs such as `provider-a/model-id` or `provider-b/model-id` and writes exact per-stage allowlists.

The example below is for reference only; `init` saves your choices, not these placeholders.

```json
{
  "version": 1,
  "defaults": { "allowUnlistedModels": false },
  "models": {
    "provider-a/model-id": {
      "enabled": true,
      "capabilities": ["planning", "coding", "testing"],
      "tier": "strong"
    },
    "provider-b/model-id": {
      "enabled": true,
      "capabilities": ["planning", "debugging", "review", "qa", "security"],
      "tier": "expert"
    }
  },
  "stages": {
    "planning": ["provider-a/model-id", "provider-b/model-id"],
    "coding": ["provider-a/model-id"],
    "debugging": ["provider-b/model-id"],
    "review": ["provider-b/model-id"],
    "qa": ["provider-b/model-id"],
    "testing": ["provider-a/model-id"],
    "security": ["provider-b/model-id"]
  }
}
```

When a stage allowlist exists, the router only considers those models. Otherwise, when candidates declare capabilities, it only considers models declaring the requested stage capability. The policy uses exact `provider/model` keys and is never fetched or modified by Workbench. Without it, the router still enforces Pi's reasoning/tools/vision/context metadata but cannot prove that a model is especially good at coding or planning.

## Session model scope

`piw run` forwards `--models` to Pi. This option limits the models available to the session; it does not edit the saved policy or set priority. Use a comma-separated list with exact provider/model IDs for predictable results. Pi also accepts fuzzy names and glob patterns.

```bash
# Show the current catalog without starting a chat.
piw run --list-models

# Scope this session; replace the sample IDs with your approved models.
piw run --models 'provider-a/model-id,provider-b/model-id'

# Select a single physical model directly instead of using the router.
piw run --model provider-a/model-id
```

With `router/auto`, the effective candidates are the available models in the session scope that are permitted by the saved policy and meet the current role and complexity requirements. For example, a model allowed only for planning cannot be selected for coding just because it is in `--models`. Include each intended fallback in the scope; Pi must schedule a retry before the router tries an alternative. If no scope is supplied, the router starts from Pi's available catalog. Check the active role with `/router-status` and use `PI_ROUTER_TRACE=1` to see selections.

## Restrict selection

```fish
PI_ROUTER_PROVIDER=openai-codex piw run
PI_ROUTER_MODEL=provider-a/model-id piw run
PI_ROUTER_TRACE=1 piw run
```

`PI_ROUTER_PROVIDER` and `PI_ROUTER_MODEL` are explicit user choices. `PI_ROUTER_TRACE=1` prints the selected provider and model but never credentials.

Catalog entries can be inaccessible under the provider account's guardrails even when adapter health succeeds. Prefer a verified scope rather than weakening those guardrails:

```fish
# Example: route only within a model verified for this installation/account.
piw run --models 'openai-codex/<approved-model>'
# Multiple approved candidates allow fallback inside that scope.
piw run --models 'provider/model-one,provider/model-two'
```

Workbench excludes every failed candidate in the current retry chain and resets that branch-local list for the next user request. Pi controls which errors trigger retries and how many retries occur. Check assistant response metadata (`stopReason`, `errorMessage`, physical `provider/model`) when evaluating JSON/RPC runs: a successful process/command response alone does not establish successful model work.

## Debugging selection

1. Confirm the adapter is installed:

   ```fish
   pi list
   ```

2. Confirm the live catalog:

   ```fish
   # Replace example with the configured adapter name.
   piw adapter health example
   piw adapter models example
   piw run --list-models
   ```

3. Run one model directly:

   ```fish
   # Replace provider-a/model-id with the exact ID to test.
   piw run --model provider-a/model-id
   ```

4. Retry `router/auto` with tracing:

   ```fish
   PI_ROUTER_TRACE=1 piw run
   ```

If direct execution works but routing fails, fix model capability metadata or select a model explicitly. Do not change credentials first.

## Direct `pi` versus `piw run`

```text
pi --model router/auto       Pi starts with its current shell/environment
piw run                      Pi starts from the current project and loads Workbench provider env files
```

Use `piw run` for configured adapters. Use bare `pi` only when you intentionally manage provider environment variables yourself.
