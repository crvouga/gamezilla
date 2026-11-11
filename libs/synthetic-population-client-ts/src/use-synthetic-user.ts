import { inspectionSchema } from '@libs/synthetic-population-shared-ts/inspection';
import { useCreateId } from '@pkgs/uuid-client-ts/solid';
import {
  type Accessor,
  createEffect,
  createMemo,
  createResource,
  createSignal,
} from 'solid-js';
import { resourceValue } from './resource-value';
import {
  type SyntheticUserDetail,
  useSyntheticPopulationApi,
} from './synthetic-population-api';
import { useSyntheticPopulationUpdates } from './use-synthetic-population-updates';

/**
 * One Synthetic User, read again on every live update. `shown` keeps the
 * last read of the Synthetic User on screen while a later read runs or
 * fails, and is cleared when the route names another one.
 */
export function useSyntheticUser(id: Accessor<string>) {
  const api = useSyntheticPopulationApi();
  const createId = useCreateId();
  const [record, { refetch }] = createResource(id, (userId) =>
    api.inspect(userId)
  );
  const [shown, setShown] = createSignal<SyntheticUserDetail>();
  createEffect(() => {
    const value = resourceValue(record);
    if (value !== undefined) setShown(value);
    else if (shown()?.id !== id()) setShown(undefined);
  });
  useSyntheticPopulationUpdates(() => refetch());
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
    await refetch();
  };
  return { record, shown, snapshot, command, refetch };
}

/** One Synthetic User's recorded events, read again on every live update. */
export function useSyntheticUserEvents(id: Accessor<string>) {
  const api = useSyntheticPopulationApi();
  const [events, { refetch }] = createResource(id, (userId) =>
    api.events(userId)
  );
  const [shown, setShown] =
    createSignal<Awaited<ReturnType<typeof api.events>>>();
  createEffect(() => {
    const value = resourceValue(events);
    if (value !== undefined) setShown(value);
  });
  useSyntheticPopulationUpdates(() => refetch());
  return { events, shown, refetch };
}
