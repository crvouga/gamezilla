// @io-wall-ok — launcher fixture: the same entry and supervisor a run script uses.
import { fileURLToPath } from 'node:url';
import { enterDevOwner } from '@pkgs/os-server/dev-owner-entry';
import { superviseDev } from '@pkgs/os-server/dev-owner-supervisor';

const root = process.argv[2] ?? '';
await enterDevOwner(root, import.meta.filename, [root]);
process.exit(
  await superviseDev(root, 'node', [
    fileURLToPath(new URL('./dev-owner-node-fixture.cjs', import.meta.url)),
    'parent',
  ])
);
