import type { AuthServerPort } from '@pkgs/auth-shared/auth-server-port';
import type { OutboxConsumerRegistry } from '@pkgs/outbox-shared/define-consumer';
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
