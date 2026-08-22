#!/usr/bin/env bun
// @io-wall-ok
import { isProductionSecretsEnv } from '../../../tools/src/deploy-mode';
import {
  buildAndSubmitClientNative,
  requireEasProfile,
} from '@libs/secrets/shared/eas-mobile';

if (!isProductionSecretsEnv()) {
  console.log('[client:deploy:native] dry-run (SECRETS_ENV is not prd)');
  try {
    const profile = requireEasProfile();
    console.log(
      `[client:deploy:native] would run EAS native build + submit (${profile})`
    );
  } catch {
    console.log('[client:deploy:native] set EAS_PROFILE=production|development');
  }
  process.exit(0);
}

const profile = requireEasProfile();
await buildAndSubmitClientNative(profile);
