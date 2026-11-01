// @io-wall-ok — re-exec the existing supervisor with an observable launch-time stamp.
import { realpathSync } from 'node:fs';
import { spawnOwned } from './dev-owner-spawn';
import { ownerParents, ownerProcess } from './dev-owner-state';

export async function enterDevOwner(
  rootPath: string,
  script: string,
  args: readonly string[]
): Promise<void> {
  const root = realpathSync(rootPath);
  if (process.env['DEV_OWNER_ROOT'] === root && process.env['DEV_OWNER_BOOT'])
    return;
  const parent = ownerProcess(process.pid);
  const boot = `launcher-${process.pid}-${parent?.identity.replace(/[^a-zA-Z0-9]/g, '')}`;
  const child = spawnOwned(process.execPath, [script, ...args], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: {
      ...process.env,
      DEV_OWNER_ROOT: root,
      DEV_OWNER_BOOT: boot,
      DEV_OWNER_LAUNCHER: JSON.stringify(parent),
      DEV_OWNER_LAUNCHERS: JSON.stringify(ownerParents(process.pid)),
    },
  });
  const stop = () => child.kill('SIGTERM');
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'])
    process.on(signal, stop);
  process.exit(
    await new Promise<number>((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code) => resolve(code ?? 1));
    })
  );
}
