#!/usr/bin/env bun
import {
  publishClientEasUpdate,
  resolveEasProfileWithNotice,
} from '@libs/secrets/shared/eas-mobile';
// @io-wall-ok
import { wallClock } from '@pkgs/clock';
import { createLogger } from '@pkgs/logger';
import { isProductionSecretsEnv } from '../../../tools/src/deploy-mode';

const log = createLogger({ name: 'client:deploy:ota', now: wallClock.now });

if (!isProductionSecretsEnv()) {
  log.info('[client:deploy:ota] dry-run (SECRETS_ENV is not prd)');
  const profile = resolveEasProfileWithNotice();
  if (profile !== null) {
    log.info(`[client:deploy:ota] would publish EAS OTA update (${profile})`);
  }
  process.exit(0);
}

const profile = resolveEasProfileWithNotice();
if (profile === null) {
  process.exit(0);
}

await publishClientEasUpdate(profile);
