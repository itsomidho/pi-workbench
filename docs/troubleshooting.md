# Troubleshooting

## Workbench commands

| Command | Purpose |
| --- | --- |
| `piw version` | Show the installed version (`--version` and `-v` also work). |
| `piw doctor` | Diagnose the local installation. |
| `piw check` | Validate the bundled Workbench files. |
| `piw paths` | Print effective XDG, override, and legacy paths. |
| `pi list` | Check what Pi packages are registered. |
| `piw run --list-models [search]` | List available models and exit. |
| `piw run --models 'provider/model-a,provider/model-b'` | Limit the models available in this session. |
| `piw model-capabilities validate [path]` | Check policy structure without contacting providers. |
| `piw adapter check <path>` | Validate a local adapter package. |
| `piw adapter install <path>` | Install and register an adapter. |
| `piw adapter configure <provider>` | Save the provider’s local connection settings. |
| `piw adapter health <provider>` | Check endpoint connectivity and authentication. |
| `piw adapter models <provider>` | Query the adapter catalog. |
| `piw adapter list` | List providers with saved environment files. |
| `/router-status` | Show the active role, selection, and last physical response model. |
| `/reload` | Reload Pi resources and extensions. |

## First checks

Run these from a stable directory such as `$HOME` or the project directory:

```fish
piw version
piw doctor
piw check
pi list
piw run --list-models
```

For a configured provider adapter (replace `example` with its name):

```fish
piw adapter check "$HOME/.pi-adapters/pi-example"
piw adapter health example
piw adapter models example
```

## `piw` is not found

Start a new shell, or run `hash -r` if you use Bash.

Then verify:

```fish
command -v piw
piw version
```

If the command is still absent, rerun the Workbench installer from `$HOME/.pi-workbench`.

## `Unknown provider`

The adapter package may not be registered, or Pi may need a restart. Replace `example` with the adapter name:

```fish
piw adapter check "$HOME/.pi-adapters/pi-example"
piw adapter install "$HOME/.pi-adapters/pi-example"
pi list
```

`pi list` shows packages. `piw run --list-models` shows provider models. Provider environment files are loaded by `piw run`; do not put API keys in `models.json`, project files, shell history, or screenshots.

## Model refresh fails

Separate the layers:

```text
health       endpoint/auth/TLS check
models       adapter catalog check
piw run      Pi registration plus catalog discovery
router       capability filtering and selection
```

Run each layer in order. If `health` fails, check VPN, URL, key, and CA. If health and models succeed but Pi fails, reinstall the adapter and restart Pi.

## `models.json` problems

A dynamic Workbench adapter should not be manually added to Pi's `models.json`. Remove stale legacy provider entries and use the adapter extension instead. Keep Pi's own runtime files intact unless you have a verified backup and a specific repair plan.

## MCP warnings

Pi supports MCP servers from `$HOME/.pi/agent/mcp.json`. Use the current schema:

```json
{
  "mcpServers": {
    "figma": {
      "url": "https://mcp.figma.com/mcp",
      "oauth": {
        "clientName": "Claude Code"
      }
    }
  }
}
```

Do not install two extensions that register the same command. If an external extension and a built-in extension both register `/mcp`, keep only one.

For Figma:

```fish
pi mcp list
pi mcp login figma
```

A Figma location/sanctions error is an external service availability issue, not a provider adapter error.

## Terminal input or `/` is broken

Restore the terminal:

```fish
stty sane
stty echo
```

Start a new shell if the current terminal remains inconsistent. The hidden credential prompt must restore terminal echo before it exits.

## Wrong working directory

Always start Pi from the project directory:

```fish
cd "$HOME/projects/my-project"
piw run
```

Inside Pi, check with:

```text
! pwd
```

`piw run` preserves the caller's working directory; `cd` into the project before starting it.

## Container differences

A container has its own home and Pi state. Host files under `/home/<user>/.pi` do not appear under `/root/.pi` in a container. Install and configure Workbench, adapters, credentials, and certificates separately in the container. Never copy a real API key into a disposable container unless explicitly required.

## Security response

If a key appears in terminal output, chat, a screenshot, or a log:

1. Revoke or rotate it.
2. Reconfigure the adapter with the new key.
3. Remove the exposed artifact where appropriate.
4. Check that credential files remain mode `0600`.
