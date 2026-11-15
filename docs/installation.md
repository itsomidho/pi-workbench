# Installation

## Consumer installation

Consumers should install a release archive rather than clone the Git repository. This keeps repository metadata out of the installation directory.

```bash
export PI_WORKBENCH_HOME="$HOME/.pi-workbench"
mkdir -p "$PI_WORKBENCH_HOME"
curl -L \
  https://github.com/itsomidho/pi-workbench/archive/refs/tags/v0.3.0.tar.gz \
  | tar -xz --strip-components=1 -C "$PI_WORKBENCH_HOME"

cd "$PI_WORKBENCH_HOME"
./scripts/install.sh
npm install -g .
pi install .
```

Verify the installation:

```bash
piw version
piw doctor
piw check
```

The application is installed at `$HOME/.pi-workbench`. The archive does not contain `.git` or other Git metadata.

## Runtime data

By default, runtime data remains outside the application directory:

```text
$HOME/.pi/agent
$HOME/.pi/standards
$HOME/.pi/tasks
```

For a fully isolated installation:

```bash
export PI_AGENT_DIR="$HOME/.pi-workbench-data/agent"
export PI_STANDARDS_DIR="$HOME/.pi-workbench-data/standards"
export PI_TASKS_DIR="$HOME/.pi-workbench-data/tasks"
cd "$HOME/.pi-workbench"
./scripts/install.sh
```

## Development installation

Contributors who need to modify the source may use Git:

```bash
git clone https://github.com/itsomidho/pi-workbench.git
cd pi-workbench
./scripts/install.sh
npm install -g .
pi install .
```

The development checkout and consumer installation are separate modes. Consumers do not need Git.
