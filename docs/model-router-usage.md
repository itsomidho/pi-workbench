# Model Router Usage

The package exposes a virtual model named `router/auto`. It selects a physical model from the models currently available to Pi, including models registered by independent `pi-<name>` adapters.

```bash
pi install /path/to/pi-workbench
PI_ROUTER_ROLE=debugger pi --model router/auto
```

Supported role profiles include `think`, `think-advisor`, `planner`, `debugger`, `code-reviewer`, and `qa`. An unknown role uses the default profile. The role is a capability hint, not a provider or model mapping.

The router prefers models that satisfy hard requirements for reasoning, tools, vision, and context size. For continuation and retry requests it stays on the previous/failed physical model to preserve tool compatibility and prompt-cache behavior. If no accessible model meets the requirements, it fails clearly instead of silently selecting an unsuitable model.

Optional local overrides are supported without changing the portable files:

```bash
PI_ROUTER_PROVIDER=example-provider \\
PI_ROUTER_MODEL=cx/gpt-6.1-sol \\
PI_ROUTER_TRACE=1 \\
PI_ROUTER_ROLE=debugger \\
  pi -e ./extensions/model-router.ts --model router/auto
```

`PI_ROUTER_PROVIDER` and `PI_ROUTER_MODEL` are explicit user choices and take precedence over automatic selection. `PI_ROUTER_TRACE=1` prints only the selected provider/model and never credentials.
