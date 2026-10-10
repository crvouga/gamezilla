// @io-wall-ok — stop-before-exec launch gate records leaders before application code runs.
import {
  type ChildProcess,
  execFileSync,
  type SpawnOptions,
  spawn,
} from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { ownerProcess, writeOwnerRecord } from './dev-owner-state';

const { ownedBunArgs } = createRequire(import.meta.url)(
  './dev-owner-command.cjs'
) as {
  ownedBunArgs(
    command: string,
    args: readonly string[],
    hook: string
  ): readonly string[];
};
const children = new Set<ChildProcess>();
export function spawnOwned(
  command: string,
  args: readonly string[],
  options: SpawnOptions = {}
): ChildProcess {
  const env = { ...process.env, ...options.env };
  const root = env['DEV_OWNER_ROOT'];
  if (!root) return spawn(command, [...args], options);
  const hook = join(import.meta.dirname, 'dev-owner-hook.cjs');
  env['NODE_OPTIONS'] =
    `${env['NODE_OPTIONS'] ?? ''} --require ${JSON.stringify(hook)}`;
  const launchArgs = ownedBunArgs(command, args, hook);
  const child = spawn(
    '/bin/sh',
    [
      '-c',
      'kill -STOP $$; exec "$@"',
      'dev-owner-gate',
      command,
      ...launchArgs,
    ],
    {
      ...options,
      env,
      detached: true,
    }
  );
  children.add(child);
  child.once('close', () => children.delete(child));
  if (child.pid === undefined) return child;
  let stopped = false;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const state = execFileSync('ps', ['-o', 'stat=', '-p', String(child.pid)], {
      encoding: 'utf8',
    });
    if (state.includes('T')) {
      stopped = true;
      break;
    }
  }
  if (!stopped) {
    child.kill('SIGKILL');
    throw new Error('Launch gate failed to stop');
  }
  const row = ownerProcess(child.pid);
  if (!row) throw new Error('Launch gate disappeared before registration');
  writeOwnerRecord(root, `pid-${child.pid}.json`, {
    ...row,
    root,
    boot: env['DEV_OWNER_BOOT'],
    command: [command, ...args].join(' '),
    cwd: options.cwd ?? process.cwd(),
    stamp: { DEV_OWNER_ROOT: root, DEV_OWNER_BOOT: env['DEV_OWNER_BOOT'] },
  });
  process.kill(child.pid, 'SIGCONT');
  return child;
}
