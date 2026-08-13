import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertProductionBundlesAtDir,
  assertProductionClientBuildEnv,
  productionClientApiOrigin,
} from '@libs/client-config/shared/production-client-bundle-guard';
import { createNodeFsObjectStore } from '@pkgs/object-store/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store/wall-node-fs';

const clientRoot = join(fileURLToPath(import.meta.url), '..', '..');
const fs = wallNodeFs();

const USAGE = `usage: production-bundle-guard-cli.ts <check-env|check-dist|check-native-dir>

  check-env          Assert EXPO_PUBLIC_API_URL is the production API origin.
  check-dist         Scan apps/client/dist for a loopback inlined API URL.
  check-native-dir   Scan apps/client/.check-native for a loopback inlined API URL.
`;

function resolveDir(subcommand: string): string {
  if (subcommand === 'check-dist') {
    return join(clientRoot, 'dist');
  }
  if (subcommand === 'check-native-dir') {
    return join(clientRoot, '.check-native');
  }
  throw new Error(`unknown dir subcommand: ${subcommand}`);
}

function dirStore(dir: string) {
  return createNodeFsObjectStore({ rootDir: dir, fs, layout: 'tree' });
}

const subcommand = process.argv[2];
if (subcommand === undefined) {
  process.stderr.write(USAGE);
  process.exit(1);
}

switch (subcommand) {
  case 'check-env':
    assertProductionClientBuildEnv();
    process.stdout.write(
      `[production-bundle-guard] EXPO_PUBLIC_API_URL=${productionClientApiOrigin()}\n`
    );
    break;
  case 'check-dist':
    await assertProductionBundlesAtDir(
      dirStore(resolveDir(subcommand)),
      'production web dist'
    );
    process.stdout.write(
      '[production-bundle-guard] production web dist API URL OK\n'
    );
    break;
  case 'check-native-dir':
    await assertProductionBundlesAtDir(
      dirStore(resolveDir(subcommand)),
      'production native export'
    );
    process.stdout.write(
      '[production-bundle-guard] production native export API URL OK\n'
    );
    break;
  default:
    process.stderr.write(USAGE);
    process.exit(1);
}
