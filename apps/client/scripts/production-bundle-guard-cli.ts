import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertProductionBundlesAtDir,
  assertProductionClientBuildEnv,
  productionClientApiOrigin,
} from '@libs/client-config/shared/production-client-bundle-guard';

const clientRoot = join(fileURLToPath(import.meta.url), '..', '..');

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
    assertProductionBundlesAtDir(resolveDir(subcommand), 'production web dist');
    process.stdout.write(
      '[production-bundle-guard] production web dist API URL OK\n'
    );
    break;
  case 'check-native-dir':
    assertProductionBundlesAtDir(
      resolveDir(subcommand),
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
