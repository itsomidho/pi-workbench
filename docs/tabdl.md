# Tabdl adapter

This page documents the public `tabdl` adapter contract. Internal upstream names are intentionally not part of the user-facing setup.

## Prerequisites

- Workbench `v0.5.10` or newer
- Pi installed and registered
- network/VPN access to the Tabdl gateway
- the rotated Tabdl API key
- the trusted Tabdl CA certificate

## Configure

```fish
piw adapter configure tabdl
```

Use these values:

```text
TABDL_BASE_URL: https://10.160.85.1:9443/v1
TABDL_API_KEY: <rotated key, entered hidden>
TABDL_CA_CERT: /home/omid/.config/pi-workbench/providers/tabdl-server.crt
```

The certificate path may differ on another machine. The file must be readable by the current user. Do not disable TLS verification.

The saved credential file is:

```text
$HOME/.config/pi-workbench/providers/tabdl.env
```

It must be mode `0600` and must contain real line breaks, not literal `\\n` text.

## Install and verify

```fish
piw adapter check "$HOME/.pi-adapters/pi-tabdl"
piw adapter install "$HOME/.pi-adapters/pi-tabdl"
piw adapter health tabdl
piw adapter models tabdl
```

`pi list` should show the package:

```text
../../.pi-adapters/pi-tabdl
```

`pi list` does not list individual models. Use:

```fish
piw run --list-models
```

## Run Tabdl

From the actual project directory:

```fish
cd "$HOME/projects/tabdeal-wp-academy"
piw run --provider tabdl --model cx/gpt-6.1-sol
```

Or let the capability router choose:

```fish
PI_ROUTER_TRACE=1 piw run
```

The wrapper loads `TABDL_BASE_URL`, `TABDL_API_KEY`, and `TABDL_CA_CERT` before starting Pi. Bare `pi` does not read this provider file automatically.

## Troubleshooting

### `TABDL_BASE_URL and TABDL_API_KEY are required`

Use `piw run`, not bare `pi`, or configure the variables explicitly in the shell. Never paste the API key into a repository or command history.

### `Unknown provider "tabdl"`

Reinstall the existing adapter package:

```fish
piw adapter check "$HOME/.pi-adapters/pi-tabdl"
piw adapter install "$HOME/.pi-adapters/pi-tabdl"
pi list
```

Then restart Pi. `pi list` confirms package registration; `piw run --list-models` confirms provider registration and live discovery.

### `Could not refresh tabdl; showing cached models`

Run the checks outside Pi:

```fish
piw adapter health tabdl
piw adapter models tabdl
```

If those succeed, restart Pi from the project directory. If they fail, check VPN reachability, the rotated key, the endpoint, and the CA path.

### `/` or terminal input behaves incorrectly

Restore the current terminal:

```fish
stty sane
stty echo
```

Then start a new shell. The credential prompt should restore terminal echo after entry.

### A key was displayed

Revoke or rotate it immediately, then run `piw adapter configure tabdl` again. Never include a real key in bug reports or screenshots.
