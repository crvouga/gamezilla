import { ensureActor } from './actor-ui';
import type { ClientCheckpointPort } from './client-checkpoint';
import type { ProductHarness } from './harness';

export function browserClientCheckpoints(
  s: ProductHarness
): ClientCheckpointPort {
  const device = async (id: string) => {
    await ensureActor(s, id);
    const checkpoint = s.actors.get(id)?.checkpoint;
    if (checkpoint === undefined)
      throw new Error(`Device ${id} cannot save checkpoints`);
    return checkpoint;
  };
  return {
    capture: async (id) => (await device(id)).capture(),
    restore: async (id, checkpoint) => (await device(id)).restore(checkpoint),
  };
}
