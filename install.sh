#!/usr/bin/env bash
# Fresh, Git-free installation from a published GitHub release.
# Bash parses this entire block before running it when piped from curl.
{
set -euo pipefail

repo=https://github.com/itsomidho/pi-workbench
install_dir="$HOME/.pi-workbench"
version=v0.5.26

fail() { printf 'Install error: %s\n' "$1" >&2; exit 1; }

case $# in
  0) ;;
  1) case "$1" in
    -h|--help) printf 'Usage: bash install.sh [vMAJOR.MINOR.PATCH]\n'; exit 0 ;;
    *) version=$1 ;;
  esac ;;
  *) fail 'Usage: bash install.sh [vMAJOR.MINOR.PATCH]' ;;
esac

if [[ -e $install_dir || -L $install_dir ]]; then
  fail "$install_dir already exists. Use piw update --yes for an existing archive installation."
fi

for command in curl tar node npm pi; do
  command -v "$command" >/dev/null || fail "Missing prerequisite: $command"
done
node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major < 22 || (major === 22 && minor < 19)) { console.error("Pi requires Node.js >= 22.19.0"); process.exit(1); }'

[[ $version =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail 'Expected a release tag like v0.5.24.'

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
