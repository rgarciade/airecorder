#!/usr/bin/env node
// Runs the Python test suite with the project's venv interpreter when it exists
// (same venv as scripts/build-python.sh), falling back to the system Python.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const isWindows = process.platform === 'win32';
const venvPython = isWindows
  ? path.join(root, 'venv', 'Scripts', 'python.exe')
  : path.join(root, 'venv', 'bin', 'python');
const python = fs.existsSync(venvPython) ? venvPython : (isWindows ? 'python' : 'python3');

const probe = spawnSync(python, ['-c', 'import pytest, numpy'], { stdio: 'ignore' });
if (probe.status !== 0) {
  console.error(`[test:py] pytest/numpy are not available for "${python}".`);
  console.error('[test:py] Install them with: pip install -r requirements-dev.txt (inside ./venv if you use it).');
  process.exit(1);
}

const result = spawnSync(python, ['-m', 'pytest', 'python/tests', '-q', ...process.argv.slice(2)], {
  cwd: root,
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
