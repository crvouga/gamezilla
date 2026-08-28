/**
 * Runs once before the Jest suite. When `SIM_REPORT` is on (any value other
 * than `"0"`), wipes `@sim/console` static report assets so the recording run
 * accumulates every scenario under `runs/latest_run/`. When reports are off
 * (`SIM_REPORT=0` or unset — Jest `setupFiles` defaults unset to `"0"`), leave
 * the previous dump in place. Also warms the sim SQL migrate seed (PGlite or
 * postgres-mem) so tests clone instead of re-migrating.
 */
const { execFileSync } = require('node:child_process');
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

function rmRecursiveWithRetry(targetPath) {
  if (!fs.existsSync(targetPath)) return;
  const rmOpts = {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 200,
  };
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    try {
      fs.rmSync(targetPath, rmOpts);
      return;
    } catch (err) {
      const code =
        err && typeof err === 'object' && 'code' in err ? err.code : undefined;
      const retryable =
        code === 'ENOTEMPTY' || code === 'EBUSY' || code === 'EPERM';
      if (!retryable || attempt === 10) throw err;
      const waitMs = 50 * attempt;
      const deadline = Date.now() + waitMs;
      while (Date.now() < deadline) {
        // spin — globalSetup must stay sync
      }
    }
  }
}

function simReportEnabled() {
  const value = process.env.SIM_REPORT;
  return value != null && value !== '0';
}

module.exports = () => {
  if (simReportEnabled()) {
    const root = findMonorepoRoot(__dirname);
    const reportsDir = path.join(root, 'sim/console/public/reports');
    rmRecursiveWithRetry(path.join(reportsDir, 'runs'));
    const keysFile = path.join(reportsDir, 'keys.json');
    if (fs.existsSync(keysFile)) {
      fs.rmSync(keysFile, { force: true, maxRetries: 5, retryDelay: 100 });
    }
    const staleFile = path.join(reportsDir, 'stale.json');
    if (fs.existsSync(staleFile)) {
      fs.rmSync(staleFile, { force: true });
    }
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const seedScript = path.join(__dirname, 'scripts/build-sim-seed.ts');
  // Use Bun's TS runner — not `bunx tsx` (tsx wraps esbuild and leaves
  // orphan `esbuild --service` processes if the Jest worker is killed).
  execFileSync('bun', [seedScript], {
    cwd: __dirname,
    stdio: 'inherit',
    env: process.env,
  });
};
