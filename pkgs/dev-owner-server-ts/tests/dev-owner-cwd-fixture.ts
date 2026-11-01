// @io-wall-ok — exercise both ownership stages from a package working directory.
import { enterDevOwner } from '@pkgs/dev-owner-server-ts/dev-owner-entry';
import { superviseDev } from '@pkgs/dev-owner-server-ts/dev-owner-supervisor';

const root = process.argv[2] ?? '';
await enterDevOwner(root, import.meta.filename, [root]);
process.exit(
  await superviseDev(root, 'node', [
    '-e',
    'process.stdout.write(require("./storybook/main.cjs"))',
  ])
);
