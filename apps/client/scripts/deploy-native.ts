#!/usr/bin/env bun
import {
  buildAndSubmitClientNative,
  requireEasProfile,
} from '@libs/secrets/shared/eas-mobile';
// @io-wall-ok
import { wallClock } from '@pkgs/clock';
import { createLogger } from '@pkgs/logger';
import { isProductionSecretsEnv } from '../../../tools/src/deploy-mode';

const log = createLogger({ name: 'client:deploy:native', now: wallClock.now });

if (!isProductionSecretsEnv()) {
  log.info('[client:deploy:native] dry-run (SECRETS_ENV is not prd)');
  try {
    const profile = requireEasProfile();
    log.info(
      `[client:deploy:native] would run EAS native build + submit (${profile})`
    );
  } catch {
    log.info('[client:deploy:native] set EAS_PROFILE=production|development');
  }
  process.exit(0);
}

const profile = requireEasProfile();
await buildAndSubmitClientNative(profile);
