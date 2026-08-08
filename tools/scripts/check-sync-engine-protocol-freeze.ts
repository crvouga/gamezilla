#!/usr/bin/env bun
/**
 * Protocol v1 freeze: `pkgs/sync-engine/src/protocol/v1.ts` must match the
 * checked-in snapshot. Shape changes require an explicit version decision.
 */
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const root = join(import.meta.dirname, '../..');
const protocolPath = join(root, 'pkgs/sync-engine/src/protocol/v1.ts');
const snapshotPath = join(
  root,
  'pkgs/sync-engine/api-reports/protocol-v1.sha256'
);

const source = await Bun.file(protocolPath).text();
const hash = createHash('sha256').update(source).digest('hex');
const line = `${hash}  protocol/v1.ts\n`;

const snapFile = Bun.file(snapshotPath);
if (!(await snapFile.exists())) {
  await Bun.write(snapshotPath, line);
  console.log('wrote missing protocol-v1.sha256');
  process.exit(0);
}

const expected = await snapFile.text();
if (expected !== line) {
  console.error('ci:sync-engine-protocol-freeze FAILED:');
  console.error(`expected: ${expected.trim()}`);
  console.error(`actual:   ${line.trim()}`);
  console.error(
    'Protocol v1 shapes are frozen. Bump SYNC_PROTOCOL_VERSION and update the snapshot only with an explicit compatibility decision.'
  );
  process.exit(1);
}

console.log('ci:sync-engine-protocol-freeze OK');
