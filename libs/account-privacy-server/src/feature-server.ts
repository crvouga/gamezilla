import type { AccountPrivacyContribution } from '@libs/feature-shared/account-privacy';
import { defineFeatureServer } from '@libs/feature-shared/server';
import type { RoomServicePort } from '@pkgs/room-shared/room-service';
import { registerPrivacyConsumers } from './privacy-consumers';

export function createAccountPrivacyServer(
  contributions: readonly AccountPrivacyContribution[],
  rooms: RoomServicePort,
  exportPreparation: 'automatic' | 'on-demand' = 'automatic'
) {
  return defineFeatureServer({
    name: 'account-privacy',
    registerOutbox: (registry) =>
      registerPrivacyConsumers(
        registry,
        contributions,
        rooms,
        exportPreparation
      ),
  });
}
