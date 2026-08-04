/**
 * Local orchestrator mirroring every gate job in
 * `.github/workflows/deployment-pipeline.yml` (`deploy.needs`).
 * Runs the six lanes in parallel so wall time matches the GHA fan-out.
 */
import { spawn } from 'node:child_process';
import { DEPLOYMENT_PIPELINE_CHECK_STEPS } from '../../libs/infra/src/cli/lib/deployment-pipeline-check-steps';

const SCRIPTS = DEPLOYMENT_PIPELINE_CHECK_STEPS.map((s) => s.bunScript);

function runScript(script: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn('bun', ['run', script], {
      stdio: 'inherit',
      env: process.env,
    });
    child.on('error', (err) => {
      console.error(`check: failed to spawn ${script}:`, err);
      resolve(1);
    });
    child.on('close', (code) => resolve(code ?? 1));
  });
}

const codes = await Promise.all(SCRIPTS.map((s) => runScript(s)));
const failed = SCRIPTS.filter((_, i) => codes[i] !== 0);
if (failed.length > 0) {
  console.error(`check: failed: ${failed.join(', ')}`);
  process.exit(1);
}
process.exit(0);
