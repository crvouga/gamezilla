/**
 * Public `check:secrets` entry: fingerprint secret-store maps, then Turbo-run
 * the validate task so unchanged values cache-hit and skip live validators.
 */
import { spawnSync } from 'node:child_process';

import {
  CHECK_SECRETS_FINGERPRINT_ENV,
  computeCheckSecretsFingerprint,
} from '../../libs/infra/src/cli/secrets/check-secrets-fingerprint';

const fingerprint = await computeCheckSecretsFingerprint();
process.env[CHECK_SECRETS_FINGERPRINT_ENV] = fingerprint;

const result = spawnSync(
  'bun',
  ['run', 'tools/scripts/turbo-ci-run.ts', 'check:secrets:validate'],
  { stdio: 'inherit', env: process.env }
);

process.exit(result.status ?? 1);
