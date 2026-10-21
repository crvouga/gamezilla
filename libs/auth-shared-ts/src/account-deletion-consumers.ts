import type { AuthServerPort } from '@pkgs/auth-root-shared-ts/auth-server-port';
import type { OutboxConsumerRegistry } from '@pkgs/outbox-shared-ts/define-consumer';
import { deletedIdentity } from './account-privacy';

export function registerAccountDeletionConsumers(
  registry: OutboxConsumerRegistry,
  auth: AuthServerPort
): void {
  registry.register({
    id: 'auth-delete-identity',
    on: deletedIdentity,
    handler: async (_ctx, payload) => {
      await auth.deleteUser(payload.externalId);
    },
  });
}
