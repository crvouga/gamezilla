#!/usr/bin/env bun
import { deployOutputs } from '@libs/secrets/shared/deploy-origins';
import { runHttpSmokeTests } from '@libs/secrets/shared/smoke-tests';
// @io-wall-ok
import { wallClock } from '@pkgs/clock';
import { createLogger } from '@pkgs/logger';
import { isProductionSecretsEnv } from '../../../tools/src/deploy-mode';

const log = createLogger({ name: 'server:smoke', now: wallClock.now });

if (!isProductionSecretsEnv()) {
  log.info(
    '[server:smoke] dry-run (SECRETS_ENV is not prd) — skipping HTTP smoke'
  );
  process.exit(0);
}

const outputs = deployOutputs();
await runHttpSmokeTests(outputs);
