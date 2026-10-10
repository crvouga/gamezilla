import { inspectionSchema } from '@libs/synthetic-population-shared/inspection';
import { useCreateId } from '@pkgs/uuid-client/solid';
import { type Accessor, createMemo, createResource } from 'solid-js';
import { useSyntheticPopulationApi } from './synthetic-population-api';
import { useSyntheticPopulationUpdates } from './use-synthetic-population-updates';

export function useSyntheticUser(id: Accessor<string>) {
  const api = useSyntheticPopulationApi();
  const createId = useCreateId();
  const [record, { refetch }] = createResource(id, async (userId) => ({
    user: await api.inspect(userId),
    events: await api.events(userId),
  }));
  useSyntheticPopulationUpdates(() => refetch());
  const snapshot = createMemo(() => {
    let raw: unknown = record()?.user.inspection;
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch {
        return null;
      }
    }
    const parsed = inspectionSchema.safeParse(raw);
    return parsed.success &&
      parsed.data.generation === record()?.user.generation
      ? parsed.data
      : null;
  });
  const command = async (value: 'pause' | 'resume' | 'restart' | 'inspect') => {
    await api.command(id(), { command: value, operationId: createId() });
    await refetch();
  };
  return { record, snapshot, command, refetch };
}
