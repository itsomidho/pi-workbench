# Provider adapters

A provider adapter is an independent Pi package that registers a provider, discovers its models, and publishes accurate capabilities to Pi and `router/auto`.

## Rules

- Adapter source defaults to `$HOME/.pi-adapters/pi-<name>`.
- The public provider name is the adapter name, for example `provider-name`.
- Credentials stay in `$HOME/.config/pi-workbench/providers/<name>.env`.
- API keys are hidden during configuration and stored with mode `0600`.
- Never commit keys, OAuth state, private certificates, or real provider responses.
- Review third-party adapter source before installing it.

## Create a new adapter

```fish
piw adapter create example
```

This creates:

```text
$HOME/.pi-adapters/pi-example
```

If the destination already exists, creation stops safely. Do not recreate it; inspect and install the existing package instead.

## Check and install

```fish
piw adapter check "$HOME/.pi-adapters/pi-example"
piw adapter install "$HOME/.pi-adapters/pi-example"
pi list
```

Installation validates the manifest, packages the adapter, installs it through Pi's package manager, and preserves the source directory. `pi list` shows packages, not model catalog entries.

## Configure credentials

```fish
piw adapter configure example
```

The command prompts for the public provider variables:

```text
EXAMPLE_BASE_URL
EXAMPLE_API_KEY
EXAMPLE_CA_CERT
```

The API key is hidden. The saved file is:

```text
$HOME/.config/pi-workbench/providers/example.env
```

It is mode `0600`. A private/self-signed service should use `*_CA_CERT`; do not disable TLS verification.

## Health and model discovery

```fish
piw adapter health example
piw adapter models example
```

`health` tests the provider endpoint. `models` queries the adapter catalog. A successful health check does not guarantee that Pi can select a model: the adapter must also be installed, and its model metadata must be compatible with the requested workflow.

The template supports:

- dynamic `/models` catalogs;
- dynamic custom paths such as `/v1/models`;
- static catalogs with `catalog.enabled: false` and a `models` array.

Dynamic adapters are queried during Pi startup and during explicit model refresh. `piw run --list-models` is the most useful end-to-end check because it loads saved provider credentials before starting Pi.

## Run with an adapter

Use `piw run`, not bare `pi`, for saved Workbench credentials:

```fish
cd "$HOME/projects/my-project"
piw run --provider example --model <model-id>
```

List every model visible to Pi:

```fish
piw run --list-models
```

Use the router:

```fish
PI_ROUTER_TRACE=1 piw run
```

Bare `pi --list-models` only works for a provider when its environment variables are already present in the shell. It does not automatically read Workbench `.env` files.

## Capability metadata

Each discovered model should report accurate values for:

```text
id
name
context window
max output tokens
tools
reasoning
vision
```

`router/auto` filters models by these values. A model can appear in `piw run --list-models` but still be rejected for a role that requires tools, reasoning, vision, or a larger context window.

## Remove or repair

Remove saved credentials only:

```fish
piw adapter remove example
```

The adapter package and source remain installed.

For an existing adapter:

```fish
piw adapter check "$HOME/.pi-adapters/pi-example"
piw adapter install "$HOME/.pi-adapters/pi-example"
piw adapter configure example
piw adapter health example
piw adapter models example
```

Do not edit Pi's `models.json` to register a dynamic Workbench adapter. The adapter extension and `piw run` are the source of truth.
