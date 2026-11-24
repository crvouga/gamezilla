import { inspectionSchema } from '@libs/synthetic-population-shared-ts/inspection';
import { createLiveRead } from '@pkgs/async-root-client-ts/live-read';
import { useCreateId } from '@pkgs/uuid-client-ts/solid';
import { type Accessor, createMemo } from 'solid-js';
import { useSyntheticPopulationApi } from './synthetic-population-api';
import { useSyntheticPopulationUpdates } from './use-synthetic-population-updates';

/**
 * One Synthetic User, read again on every live update. `shown` keeps the
 * last read of the Synthetic User on screen while a later read runs or
 * fails, and is cleared when the route names another one.
 */
export function useSyntheticUser(id: Accessor<string>) {
  const api = useSyntheticPopulationApi();
  const createId = useCreateId();
  const record = createLiveRead(
    () => id() || undefined,
    (userId) => api.inspect(userId)
  );
  const shown = createMemo(() => {
    const value = record.shown();
    return record.failed() && value?.id !== id() ? undefined : value;
  });
  useSyntheticPopulationUpdates(record.reread);
  const snapshot = createMemo(() => {
    let raw: unknown = shown()?.inspection;
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch {
        return null;
      }
    }
    const parsed = inspectionSchema.safeParse(raw);
    return parsed.success && parsed.data.generation === shown()?.generation
      ? parsed.data
      : null;
  });
  const command = async (value: 'pause' | 'resume' | 'restart' | 'inspect') => {
    await api.command(id(), { command: value, operationId: createId() });
    await record.reread();
  };
  return {
    shown,
    loading: record.loading,
    failed: record.failed,
    snapshot,
    command,
    reread: record.reread,
  };
}

/** One Synthetic User's recorded events, read again on every live update. */
export function useSyntheticUserEvents(id: Accessor<string>) {
  const api = useSyntheticPopulationApi();
  const events = createLiveRead(
    () => id() || undefined,
    (userId) => api.events(userId)
  );
  useSyntheticPopulationUpdates(events.reread);
  return events;
}
