// @io-wall-ok — existing finite-run supervisors register their workers with the same ownership ledger.
import { realpathSync } from 'node:fs';
import { join } from 'node:path';
import { gcDevOwner } from './dev-owner-gc';
import { spawnOwned } from './dev-owner-spawn';
import {
  type OwnerBoot,
  ownerParents,
  ownerProcess,
  ownerRecords,
  writeOwnerRecord,
} from './dev-owner-state';

export async function openOwnerRun(rootPath: string): Promise<{
  env: NodeJS.ProcessEnv;
  close(): Promise<void>;
}> {
  const root = realpathSync(rootPath);
  const inheritedBoot =
    process.env['DEV_OWNER_ROOT'] === root
      ? process.env['DEV_OWNER_BOOT']
      : undefined;
  if (
    inheritedBoot &&
    ownerRecords<OwnerBoot>(root, 'boot-').some(
      (entry) => entry.id === inheritedBoot
    )
  )
    return { env: process.env, async close() {} };
  await gcDevOwner(root);
  const supervisor = ownerProcess(process.pid);
  if (!supervisor) throw new Error('Cannot identify run supervisor');
  const boot =
    inheritedBoot ??
    `run-${process.pid}-${supervisor.identity.replace(/[^a-zA-Z0-9]/g, '')}`;
  writeOwnerRecord(root, `boot-${boot}.json`, {
    id: boot,
    root,
    supervisor,
    launchers: ownerParents(process.pid),
  });
  const env = { ...process.env, DEV_OWNER_ROOT: root, DEV_OWNER_BOOT: boot };
  const watchdog = spawnOwned(
    process.execPath,
    [join(import.meta.dirname, 'dev-owner-watch.ts')],
    { cwd: root, env, stdio: 'inherit' }
  );
  return {
    env,
    async close() {
      await gcDevOwner(root, true, boot);
      watchdog.kill('SIGTERM');
    },
  };
}
