#!/usr/bin/env bun
// @io-wall-ok
import { isProductionSecretsEnv } from '../../../tools/src/deploy-mode';
import { deployOutputs } from '@libs/secrets/shared/deploy-origins';
import { runHttpSmokeTests } from '@libs/secrets/shared/smoke-tests';

if (!isProductionSecretsEnv()) {
  console.log('[server:smoke] dry-run (SECRETS_ENV is not prd) — skipping HTTP smoke');
  process.exit(0);
}

const outputs = deployOutputs();
await runHttpSmokeTests(outputs);
