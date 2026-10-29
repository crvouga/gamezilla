// @io-wall-ok — adversarial Node fixture owns real OS lifecycles.
const { spawn } = require('node:child_process');
const { writeFileSync } = require('node:fs');
const { join } = require('node:path');
const timers = require('node:timers');
const mode = process.argv[2];
process.on('SIGTERM', () => {});
if (mode === 'parent' || mode === 'child') {
  spawn(
    process.execPath,
    [__filename, mode === 'parent' ? 'child' : 'grandchild'],
    {
      env: process.env,
      detached: true,
      stdio: 'ignore',
    }
  );
}
const readyDir = process.env.DEV_OWNER_READY_DIR;
if (readyDir)
  writeFileSync(join(readyDir, `ready-${mode}`), String(process.pid));
timers.setInterval(() => {}, 1000);
