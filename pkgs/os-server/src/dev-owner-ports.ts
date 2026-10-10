// @io-wall-ok — stable per-checkout port claims; occupied ports fail without signalling listeners.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ownerDir, writeOwnerRecord } from './dev-owner-state';

let index = 0;
export function nextOwnerPort(): number {
  const root = process.env['DEV_OWNER_ROOT'];
  if (!root || process.env['DEV_OWNER_PORTS'] !== '1') return 0;
  try {
    const ports = JSON.parse(
      readFileSync(join(ownerDir(root), 'ports.json'), 'utf8')
    ) as number[];
    return ports[index] ?? 0;
  } catch {
    return 0;
  }
}
export function recordOwnerPort(port: number): void {
  const root = process.env['DEV_OWNER_ROOT'];
  if (!root || process.env['DEV_OWNER_PORTS'] !== '1') return;
  let ports: number[] = [];
  try {
    ports = JSON.parse(
      readFileSync(join(ownerDir(root), 'ports.json'), 'utf8')
    ) as number[];
  } catch {
    /* first boot */
  }
  ports[index++] = port;
  writeOwnerRecord(root, 'ports.json', ports);
  writeOwnerRecord(root, `listen-${port}.json`, {
    port,
    pid: process.pid,
    root,
    boot: process.env['DEV_OWNER_BOOT'],
  });
}
