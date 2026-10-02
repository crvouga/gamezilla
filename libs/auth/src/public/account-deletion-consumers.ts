import type { AuthServerPort } from '@pkgs/auth/server';
import type { OutboxConsumerRegistry } from '@pkgs/outbox';
import { deletedIdentity } from '../shared/auth/account-privacy';

export function registerAccountDeletionConsumers(registry: OutboxConsumerRegistry, auth: AuthServerPort): void {
  registry.register({ id: 'auth-delete-identity', on: deletedIdentity, handler: async (_ctx, payload) => { await auth.deleteUser(payload.externalId); } });
}
