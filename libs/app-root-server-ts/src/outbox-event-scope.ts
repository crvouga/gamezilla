import { OutboxConsumerRegistry } from '@pkgs/outbox-shared-ts/define-consumer';
import { OUTBOX_EVENTS_TABLE } from '@pkgs/outbox-shared-ts/tables';
import type { WriteCaptureSnapshot } from '@pkgs/sync-engine-shared-ts/write-capture';

/** Missing type images keep the full registry rather than dropping a delivery. */
export function capturedOutboxScope(captures: readonly WriteCaptureSnapshot[]) {
  const ids = new Set<string>();
  const types = new Set<string>();
  for (const capture of captures) {
    const images = capture.images[OUTBOX_EVENTS_TABLE] ?? [];
    for (const id of capture.ids[OUTBOX_EVENTS_TABLE] ?? []) {
      ids.add(id);
      const type = images.find((row) => row['id'] === id)?.['type'];
      if (typeof type !== 'string')
        return {
          eventIds: [
            ...new Set(
              captures.flatMap((part) => part.ids[OUTBOX_EVENTS_TABLE] ?? [])
            ),
          ],
        };
      types.add(type);
    }
  }
  return { eventIds: [...ids], eventTypes: [...types] };
}

export function consumersForEvents(
  registry: OutboxConsumerRegistry,
  types: ReadonlySet<string>
): OutboxConsumerRegistry {
  const scoped = new OutboxConsumerRegistry();
  for (const type of types) scoped.registerAll(registry.consumersForType(type));
  return scoped;
}

export function extendEventTypes(
  known: ReadonlySet<string> | undefined,
  captured: readonly string[] | undefined
): Set<string> | undefined {
  return known === undefined || captured === undefined
    ? undefined
    : new Set([...known, ...captured]);
}
