// @io-wall-ok — development process entry.
import { existsSync } from 'node:fs';
import { enterDevOwner } from '@pkgs/os-server/dev-owner-entry';
import { superviseDev } from '@pkgs/os-server/dev-owner-supervisor';
import { resolveDevRepoRoot } from './dev-repo-root';
import { parseStackOptions } from './stack-options';

const args = process.argv.slice(2).filter((arg) => arg !== '--');
parseStackOptions(args);
const repoRoot = resolveDevRepoRoot(import.meta.dir, existsSync);
await enterDevOwner(repoRoot, import.meta.filename, args);
process.exit(
  await superviseDev(repoRoot, 'bun', ['run', 'apps/product/scripts/cli.ts'], {
    DEV_OWNER_SERVICES: '1',
    DEV_OWNER_PORTS: '1',
    LOCALHOST_STACK_ARGS: JSON.stringify([...args, '--instance', 'dev']),
  })
);
