// @io-wall-ok — resources delegated to system daemons retain checkout and boot ownership.
import { execFileSync } from 'node:child_process';
import {
  type OwnerBoot,
  ownerProcess,
  ownerRecords,
  processSnapshot,
  sameProcess,
  writeOwnerRecord,
} from './dev-owner-state';

export type DevResource = {
  kind: 'simulator' | 'container';
  id: string;
  root: string;
  boot: string;
};
export function registerDevSimulator(root: string, udid: string): void {
  const rows = processSnapshot();
  const boot = ownerRecords<OwnerBoot>(root, 'boot-').find((entry) =>
    rows.some((row) => sameProcess(row, entry.supervisor))
  );
  const supervisor = ownerProcess(process.pid);
  if (!supervisor) throw new Error('Cannot identify simulator launcher');
  const ownership = boot ?? {
    id: `simulator-${process.pid}-${supervisor.identity.replace(/[^a-zA-Z0-9]/g, '')}`,
    root,
    supervisor,
  };
  if (!boot) writeOwnerRecord(root, `boot-${ownership.id}.json`, ownership);
  writeOwnerRecord(root, `resource-${udid}.json`, {
    kind: 'simulator',
    id: udid,
    root,
    boot: ownership.id,
  });
}
export function registerDevContainer(id: string): void {
  const root = process.env['DEV_OWNER_ROOT'];
  const boot = process.env['DEV_OWNER_BOOT'];
  if (root && boot)
    writeOwnerRecord(root, `resource-${id}.json`, {
      kind: 'container',
      id,
      root,
      boot,
    });
}
export function stopDevResources(
  root: string,
  eligible: (boot: string) => boolean
): void {
  const resources = ownerRecords<DevResource>(root, 'resource-');
  for (const resource of resources) {
    if (
      resource.kind !== 'simulator' ||
      resource.root !== root ||
      !eligible(resource.boot)
    )
      continue;
    try {
      execFileSync('xcrun', ['simctl', 'shutdown', resource.id], {
        stdio: 'ignore',
        timeout: 10000,
      });
    } catch {
      /* already stopped */
    }
  }
  if (
    !resources.some(
      (resource) => resource.kind === 'container' && eligible(resource.boot)
    )
  )
    return;
  try {
    const output = execFileSync(
      'docker',
      [
        'ps',
        '--filter',
        `label=dev.owner.root=${root}`,
        '--format',
        '{{.ID}}\t{{.Label "dev.owner.boot"}}',
      ],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 2000,
      }
    );
    const ids = output
      .trim()
      .split('\n')
      .flatMap((line) => {
        const [id, boot] = line.split('\t');
        return id && boot && eligible(boot) ? [id] : [];
      });
    if (ids.length)
      execFileSync('docker', ['stop', '-t', '3', ...ids], {
        stdio: 'ignore',
        timeout: 10000,
      });
  } catch {
    /* Docker unavailable or no owned containers. */
  }
}
