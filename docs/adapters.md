# Provider Adapters

Adapters are independent Pi packages. They connect Pi to a provider, discover its models, and publish model capabilities for `router/auto`.

## Create

```bash
piw adapter create tabdl
```

The generated package is independent of `pi-workbench`, is named `pi-tabdl`, and is stored at `$HOME/.pi-adapters/pi-tabdl` by default.

## Implement and check

Edit `manifest.json` and `extensions/provider.ts`, then run:

```bash
piw adapter check "$HOME/.pi-adapters/pi-tabdl"
```

The template supports three model catalog modes:

- Dynamic `/models` catalog (default).
- Dynamic custom catalog path, such as `/v1/models`, set in `manifest.json`.
- Static catalog with `catalog.enabled: false` and a `models` array in `manifest.json`.

A model should declare `tools`, `vision`, `reasoning`, `contextWindow`/`context_length`, and `maxTokens`/`max_completion_tokens` accurately. The router filters models by these capabilities.

## Install

```bash
piw adapter install "$HOME/.pi-adapters/pi-tabdl"
```

This validates, packages, installs the npm package, and registers it with Pi. The adapter source remains in its original directory.

## Configure credentials

```bash
piw adapter configure tabdl
```

The command asks for the base URL, API key, and an optional CA certificate path. It hides the key while typing and stores the values at:

```text
$HOME/.config/pi-workbench/providers/tabdl.env
```

The file is mode `0600` and is never stored in the adapter or project repository. The public names remain provider-specific, for example `TABDL_BASE_URL`, `TABDL_API_KEY`, and `TABDL_CA_CERT`; upstream project names are not exposed.

## Health and models

```bash
piw adapter health tabdl
piw adapter models tabdl
piw adapter list
```

`health` and `models` load the saved credentials automatically.

## Run Pi

```bash
cd "$HOME/projects/demo-site"
piw run --provider tabdl --model <model-id>
```

`piw run` loads configured provider credentials automatically. When using `router/auto`, all configured provider env files are loaded so the router can discover models from every installed adapter.

```bash
PI_ROUTER_TRACE=1 piw run
```

If a provider has no compatible model, inspect its catalog and capability metadata first:

```bash
piw adapter models tabdl
```

## Static catalog example

```json
{
  "catalog": { "enabled": false },
  "models": [
    {
      "id": "tabdl-large",
      "name": "Tabdl Large",
      "contextWindow": 128000,
      "maxTokens": 8192,
      "tools": true,
      "vision": false,
      "reasoning": true
    }
  ]
}
```

## Remove credentials

```bash
piw adapter remove tabdl
```

This removes local credentials only. It does not remove the adapter package or source directory.
