#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
install_dependencies=0
for arg in "$@"; do
  case "$arg" in
    --install-dependencies) install_dependencies=1 ;;
    --help|-h) printf 'Usage: %s [--install-dependencies]\n' "$0"; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

if [ "$install_dependencies" = "1" ]; then
  command -v apt-get >/dev/null || { echo "Dependency bootstrap currently requires apt-get." >&2; exit 1; }
  if [ "$(id -u)" -eq 0 ]; then apt_prefix=(); else command -v sudo >/dev/null || { echo "Install dependencies as root or install sudo." >&2; exit 1; }; apt_prefix=(sudo); fi
  "${apt_prefix[@]}" apt-get update
  "${apt_prefix[@]}" env DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a apt-get install -y nodejs npm curl ca-certificates tar
fi

for command in node npm; do command -v "$command" >/dev/null || { echo "Missing prerequisite: $command (rerun with --install-dependencies on apt-based systems)" >&2; exit 1; }; done
if ! command -v pi >/dev/null; then
  [ "$install_dependencies" = "1" ] || { echo "Missing prerequisite: pi (install Pi or rerun with --install-dependencies)" >&2; exit 1; }
  pi_package="${PI_PACKAGE:-@earendil-works/pi-coding-agent}"
  npm install -g "$pi_package"
fi
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
