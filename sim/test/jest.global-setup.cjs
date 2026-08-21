/**
 * Runs once before the Jest suite. Wipes `@sim/console` static report assets so
 * the run accumulates every scenario under `runs/latest_run/` (module-level
 * wipe flags reset between test files under jest-expo).
 */
const fs = require('node:fs');
const path = require('node:path');

function findMonorepoRoot(startDir) {
  let dir = path.resolve(startDir);
  let found = null;
  for (;;) {
    if (fs.existsSync(path.join(dir, 'turbo.json'))) found = dir;
    const parent = path.dirname(dir);
    if (parent === dir) return found ?? path.resolve(startDir);
    dir = parent;
  }
}

module.exports = () => {
  const root = findMonorepoRoot(__dirname);
  const reportsDir = path.join(root, 'sim/console/public/reports');
  fs.rmSync(reportsDir, { recursive: true, force: true });
  fs.mkdirSync(reportsDir, { recursive: true });
};
