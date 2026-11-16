# Model router

Pi Workbench provides the virtual model `router/auto`. It selects a physical model from Pi's currently available providers and adapters.

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
piw run --provider tabdl --model cx/gpt-6.1-sol
```

## Role requirements

Set a role when a stage needs a capability profile:

```fish
PI_ROUTER_ROLE=planner piw run
PI_ROUTER_ROLE=debugger piw run
PI_ROUTER_ROLE=code-reviewer piw run
PI_ROUTER_ROLE=qa piw run
```

`PI_ROUTER_ROLE` initializes the role when the extension loads. An explicit `/router-role <role>` command (or `setRouterRole()`) overrides that initial role for the current runtime; it does not rewrite the environment. Reloading starts from the environment again. Unknown roles fail explicitly rather than silently selecting the default.

Inside Pi:

```text
/router-role think
/router-status
```

The role applies to the next user request using `router/auto`; it does not reroute an already running request or a directly selected physical model. Status distinguishes the effective role's base requirements, selected model, and the last physical response model on the current branch. That last response is historical evidence, not a prediction for the next request; prompt inference can add reasoning to the base profile.

Roles are capability hints, not provider/model aliases or tool permissions. In particular, `think-advisor` does not create a delegated agent, and `tools: false` does not disable tools. Delegate only through a verified read-only or tool-less execution boundary; otherwise disclose coordinator-only analysis. Set the advisor role in the delegated runtime, not in the coordinator. The router considers tools, reasoning, vision, and context window. A model may be visible in the catalog but rejected for a role if its metadata does not satisfy the role.

## Restrict selection

```fish
PI_ROUTER_PROVIDER=tabdl piw run
PI_ROUTER_MODEL=cx/gpt-6.1-sol piw run
PI_ROUTER_TRACE=1 piw run
```

`PI_ROUTER_PROVIDER` and `PI_ROUTER_MODEL` are explicit user choices. `PI_ROUTER_TRACE=1` prints the selected provider and model but never credentials.

## Debugging selection

1. Confirm the adapter is installed:

   ```fish
   pi list
   ```

2. Confirm the live catalog:

   ```fish
   piw adapter health tabdl
   piw adapter models tabdl
   piw run --list-models
   ```

3. Run one model directly:

   ```fish
   piw run --provider tabdl --model <model-id>
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
