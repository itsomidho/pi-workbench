#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
for command in node npm; do command -v "$command" >/dev/null || { echo "Missing prerequisite: $command" >&2; exit 1; }; done
agent_dir="${PI_AGENT_DIR:-$HOME/.pi/agent}"
standards_dir="${PI_STANDARDS_DIR:-$HOME/.pi/standards}"
tasks_dir="${PI_TASKS_DIR:-$HOME/.pi/tasks}"
mkdir -p "$agent_dir" "$standards_dir" "$tasks_dir"
if command -v pi >/dev/null; then echo "Pi found: $(command -v pi)"; else echo "Pi is not installed. Install it with your chosen package manager, then rerun this script."; fi
printf 'Portable config root: %s\n' "$root"
printf 'Pi agent directory: %s\n' "$agent_dir"
printf 'Standards root: %s\n' "$standards_dir"
printf 'Task workspace: %s\n' "$tasks_dir"
if [ "${PI_INSTALL_LOCAL_PACKAGE:-0}" = "1" ] && command -v pi >/dev/null; then
  pi install "$root"
  echo "Installed pi-workbench as a local Pi package."
fi
