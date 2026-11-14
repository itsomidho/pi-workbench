#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
command -v node >/dev/null || { echo 'node is required' >&2; exit 1; }
node "$root/scripts/verify-workflows.mjs"
node "$root/scripts/adapter-contract.test.mjs"
echo 'Doctor checks passed.'
