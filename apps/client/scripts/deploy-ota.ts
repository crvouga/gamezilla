#!/usr/bin/env bun
// @io-wall-ok
import { isProductionSecretsEnv } from '../../../tools/src/deploy-mode';
import {
  publishClientEasUpdate,
  resolveEasProfileWithNotice,
} from '@libs/secrets/shared/eas-mobile';

if (!isProductionSecretsEnv()) {
  console.log('[client:deploy:ota] dry-run (SECRETS_ENV is not prd)');
  const profile = resolveEasProfileWithNotice();
  if (profile !== null) {
    console.log(`[client:deploy:ota] would publish EAS OTA update (${profile})`);
  }
  process.exit(0);
}

const profile = resolveEasProfileWithNotice();
if (profile === null) {
  process.exit(0);
}

await publishClientEasUpdate(profile);
