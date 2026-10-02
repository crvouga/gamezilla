import type { AccountPrivacyContribution } from '@libs/feature/public/account-privacy';
import { defineFeatureServer } from '@libs/feature/public/server';
import { registerPrivacyConsumers } from './privacy-consumers';

export function createAccountPrivacyServer(
  contributions: readonly AccountPrivacyContribution[],
  exportPreparation: 'automatic' | 'on-demand' = 'automatic'
) {
  return defineFeatureServer({
    name: 'account-privacy',
    registerOutbox: (registry) =>
      registerPrivacyConsumers(registry, contributions, exportPreparation),
  });
}
