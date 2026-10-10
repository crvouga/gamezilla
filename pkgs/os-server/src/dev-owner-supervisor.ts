// @io-wall-ok — boot admission and lifetime are held by the existing launcher.
import { Database } from 'bun:sqlite';
import { mkdirSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { gcDevOwner } from './dev-owner-gc';
import { spawnOwned } from './dev-owner-spawn';
import { ownerDir, ownerProcess, writeOwnerRecord } from './dev-owner-state';

export async function superviseDev(
  checkout: string,
  command: string,
  args: readonly string[],
  extraEnv: NodeJS.ProcessEnv = {}
): Promise<number> {
  const root = realpathSync(checkout);
  mkdirSync(ownerDir(root), { recursive: true });
  const lease = new Database(join(ownerDir(root), 'lease.sqlite'), {
    create: true,
  });
  try {
    lease.run('BEGIN EXCLUSIVE');
  } catch {
    lease.close();
    process.stdout.write(
      '[dev] This checkout already has a live boot; reusing it.\n'
    );
    return 0;
  }
  try {
    await gcDevOwner(root);
    const supervisor = ownerProcess(process.pid);
    if (!supervisor) throw new Error('Cannot identify supervisor');
    const boot =
      process.env['DEV_OWNER_BOOT'] ??
      `${process.pid}-${supervisor.identity.replace(/[^a-zA-Z0-9]/g, '')}`;
    const launcher = process.env['DEV_OWNER_LAUNCHER']
      ? JSON.parse(process.env['DEV_OWNER_LAUNCHER'])
      : null;
    writeOwnerRecord(root, `boot-${boot}.json`, {
      id: boot,
      root,
      supervisor,
      launcher,
      launchers: JSON.parse(process.env['DEV_OWNER_LAUNCHERS'] ?? '[]'),
    });
    const env = {
      ...process.env,
      ...extraEnv,
      DEV_OWNER_ROOT: root,
      DEV_OWNER_BOOT: boot,
    };
    const watchdog = spawnOwned(
      process.execPath,
      [join(import.meta.dirname, 'dev-owner-watch.ts')],
      { cwd: root, env, stdio: 'inherit' }
    );
    const child = spawnOwned(command, args, {
      cwd: root,
      env,
      stdio: 'inherit',
    });
    const done = new Promise<number>((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code) => resolve(code ?? 1));
    });
    let stopping: Promise<void> | undefined;
    const stop = () => {
      stopping ??= gcDevOwner(root, true, boot);
      void stopping;
    };
    for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'])
      process.on(signal, stop);
    try {
      return await done;
    } finally {
      await (stopping ?? gcDevOwner(root, true, boot));
      watchdog.kill('SIGTERM');
      for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'])
        process.off(signal, stop);
    }
  } finally {
    lease.close();
  }
}
