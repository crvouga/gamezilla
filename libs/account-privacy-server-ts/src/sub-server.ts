import type { AccountPrivacyContribution } from '@libs/sub-shared-ts/account-privacy';
import { defineSubServer } from '@libs/sub-shared-ts/server';
import type { RoomServicePort } from '@pkgs/room-root-shared-ts/room-service';
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
