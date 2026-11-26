import { requireRequestStore } from '@libs/app-root-shared-ts/request-scope';
import { UnauthorizedError } from '@libs/auth-shared-ts/unauthorized-error';
import { HttpPubSubFromSecretStore } from '@libs/pubsub-server-ts/create-http-pubsub-from-secret-store';
import {
  SYNTHETIC_POPULATION_EVENT_PROTOCOL,
  SYNTHETIC_POPULATION_TOPIC,
} from '@libs/synthetic-population-shared-ts/synthetic-population-topic';

export async function readSecret(name: string): Promise<string> {
  const value = (
    await requireRequestStore().secretStore.getOptional(name)
  )?.readSecretValue();
  if (value === undefined || value.length < 32)
    throw new UnauthorizedError('Synthetic Population is not configured');
  return value;
}

async function publishSyntheticPopulation(
  message: Readonly<Record<string, unknown>>
): Promise<void> {
  const store = requireRequestStore();
  const pubsub = await new HttpPubSubFromSecretStore(
    store.secretStore,
    store.clock.now,
    store.http
  ).get();
  if (pubsub === undefined) return;
  await pubsub.publish(SYNTHETIC_POPULATION_TOPIC, {
    ...message,
    protocolVersion: SYNTHETIC_POPULATION_EVENT_PROTOCOL,
  });
}

export async function notifySyntheticPopulation(): Promise<void> {
  await publishSyntheticPopulation({ type: 'synthetic-population-changed' });
}
