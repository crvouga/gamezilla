import type { AccountPrivacyContribution } from '@libs/sub-shared/account-privacy';
import { defineSubServer } from '@libs/sub-shared/server';
import type { RoomServicePort } from '@pkgs/room-root-shared/room-service';
import { registerPrivacyConsumers } from './privacy-consumers';

export function createAccountPrivacyServer(
  contributions: readonly AccountPrivacyContribution[],
  rooms: RoomServicePort,
  exportPreparation: 'automatic' | 'on-demand' = 'automatic'
) {
  return defineSubServer({
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
