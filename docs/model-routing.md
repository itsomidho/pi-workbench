# Capability-Based Model Routing

Workflows must request capabilities, never a vendor or model ID. The installed Pi catalog resolves the concrete model at runtime.

## Role profile

```json
{
  "role": "debugger",
  "requirements": {
    "reasoning": "high",
    "coding": "high",
    "toolUse": "required",
    "contextWindowMin": 100000,
    "vision": false
  },
  "policy": {
    "preferQuality": true,
    "allowFallback": true,
    "maxCost": "normal"
  }
}
```

## Selection order

1. Explicit user model/provider override.
2. Local quality and cost policy.
3. Required capabilities and protocol support.
4. Context-window and output limits.
5. Provider availability and credentials.
6. Quality tier, then cost and latency.

If no model satisfies the hard requirements, stop with a clear explanation unless the user has allowed fallback. Record the selected `provider/model`, requirements, fallback, and reason in the task report.

The router is an orchestration concern. A third-party `pi-<name>` adapter only exposes connectivity, credentials, model discovery, normalization, and health information.
