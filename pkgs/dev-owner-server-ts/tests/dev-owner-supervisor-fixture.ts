// @io-wall-ok — process admission fixture.
import { fileURLToPath } from 'node:url';
import { superviseDev } from '@pkgs/dev-owner-server-ts/dev-owner-supervisor';

process.exit(
  await superviseDev(process.argv[2] ?? '', 'node', [
    fileURLToPath(new URL('./dev-owner-node-fixture.cjs', import.meta.url)),
    'parent',
  ])
);
