import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function workbenchPaths(env = process.env, home = env.HOME || os.homedir()) {
  const xdg = (key, fallback) => path.join(path.isAbsolute(env[key] || '') ? env[key] : path.join(home, fallback), 'pi-workbench');
  const config = xdg('XDG_CONFIG_HOME', '.config');
  const state = xdg('XDG_STATE_HOME', '.local/state');
  const legacy = name => path.join(home, '.pi', name);
  const exists = file => {
    try { fs.lstatSync(file); return true; }
    catch (error) { if (error.code === 'ENOENT') return false; throw error; }
  };
  const select = (key, preferred, previous) => {
    const override = env[key];
    if (override) return path.resolve(override === '~' ? home : override.startsWith('~/') ? path.join(home, override.slice(2)) : override);
    return preferred !== previous && !exists(preferred) && exists(previous) ? previous : preferred;
  };
  return {
    config,
    state,
    get modelCapabilities() { return select('PI_MODEL_CAPABILITIES_FILE', path.join(config, 'model-capabilities.json'), legacy('model-capabilities.json')); },
    get providers() { return select('PI_WORKBENCH_CONFIG_DIR', path.join(config, 'providers'), path.join(home, '.config/pi-workbench/providers')); },
    get standards() { return select('PI_STANDARDS_DIR', path.join(config, 'standards'), legacy('standards')); },
    get tasks() { return select('PI_TASKS_DIR', path.join(state, 'tasks'), legacy('tasks')); },
    get think() { return select('PI_THINK_DIR', path.join(state, 'think'), legacy('think')); },
  };
}
