#!/usr/bin/env bash
# Git-free installation and updates from published GitHub releases.
# Bash parses this entire block before running it when piped from curl.
{
set -euo pipefail

repo=https://github.com/itsomidho/pi-workbench
install_dir="$HOME/.pi-workbench"
version=v0.5.28

fail() { printf 'Install error: %s\n' "$1" >&2; exit 1; }

case $# in
  0) ;;
  1) case "$1" in
    -h|--help) printf 'Usage: bash install.sh [vMAJOR.MINOR.PATCH]\n'; exit 0 ;;
    *) version=$1 ;;
  esac ;;
  *) fail 'Usage: bash install.sh [vMAJOR.MINOR.PATCH]' ;;
esac

[[ ! -L $install_dir ]] || fail "Refusing a symlink: $install_dir"
[[ ! -e $install_dir/.git && ! -L $install_dir/.git ]] || fail 'Git checkout detected. Update it with Git.'

for command in curl tar node npm pi; do
  command -v "$command" >/dev/null || fail "Missing prerequisite: $command"
done
node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major < 22 || (major === 22 && minor < 19)) { console.error("Pi requires Node.js >= 22.19.0"); process.exit(1); }'

[[ $version =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail 'Expected a release tag like v0.5.24.'

if [[ -e $install_dir ]]; then
  updater="$install_dir/scripts/update.mjs"
  [[ -d $install_dir && -f $install_dir/package.json && ! -L $install_dir/package.json && -f $updater && ! -L $updater && ! -L $install_dir/scripts ]] ||
    fail "$install_dir is not a recognized archive installation."
  installed=$(node --input-type=module -e '
    import fs from "node:fs";
    const p = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    if (p.name !== "pi-workbench" || !/^\d+\.\d+\.\d+$/.test(p.version)) process.exit(1);
    console.log("v" + p.version);
  ' "$install_dir/package.json") || fail "$install_dir is not a recognized archive installation."
  if [[ $# -gt 0 ]]; then
    if [[ $version == "$installed" ]]; then
      printf 'Already installed: %s\n' "$installed"
      exit 0
    fi
    fail 'An explicit tag is for fresh installs. Rerun without a tag to update to the latest release.'
  fi
  PI_WORKBENCH_HOME="$install_dir" node "$updater" --yes
  exit
fi

scratch=$(mktemp -d)
trap 'rm -rf -- "$scratch"' EXIT
curl -fsSL "$repo/archive/refs/tags/$version.tar.gz" -o "$scratch/release.tar.gz"
mkdir "$scratch/app"
tar -xzf "$scratch/release.tar.gz" --strip-components=1 -C "$scratch/app"
node -e 'const p = require(process.argv[1]); if (p.name !== "pi-workbench" || `v${p.version}` !== process.argv[2]) { console.error("Release archive identity or version does not match the requested tag."); process.exit(1); }' "$scratch/app/package.json" "$version"
[[ -f $scratch/app/scripts/install.sh ]] || fail 'Release archive is missing scripts/install.sh.'

# Do not merge into an existing directory, even if it appeared during download.
mkdir "$install_dir"
cp -R "$scratch/app/." "$install_dir/"
PI_WORKBENCH_HOME="$install_dir" bash "$install_dir/scripts/install.sh"
}
