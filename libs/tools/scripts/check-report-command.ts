// @io-wall-ok — invoke the publication entry with the existing injected process environment.
import { spawnSync } from 'node:child_process';

export function reportCommand(
  root: string,
  env: NodeJS.ProcessEnv,
  args: string[]
): void {
  const result = spawnSync(
    'bun',
    ['run', 'libs/harness/scripts/report-publish.ts', ...args],
    { cwd: root, env, stdio: 'inherit' }
  );
  if (result.status !== 0)
    throw new Error(`Report ${args[0]} failed (${result.status})`);
}
