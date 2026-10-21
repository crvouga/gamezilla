import type { MutationFeedbackScope } from '@pkgs/sync-engine-client-ts/mutation-status';
import type { ProductHarness } from './harness';
import { deviceMemberIdOf } from './identity';

/** Read the same durable choice feedback the person's controls subscribe to. */
export async function readMutationFeedback(
  s: ProductHarness,
  actor: string,
  choice: { readonly name: string; readonly scope?: MutationFeedbackScope }
) {
  const client = await s.harness.spawnClient(actor);
  const identity = await deviceMemberIdOf(s, actor);
  if (identity === null) throw new Error(`${actor} has no local identity`);
  const database = client.env.resolveDatabaseName({ userId: identity });
  const engine = client.syncEnginePool.peekReady(database);
  if (engine === null) throw new Error(`${actor} has no ready sync engine`);
  const feedback = engine.mutationFeedback(choice.name, choice.scope);
  let unsubscribe: (() => void) | undefined;
  try {
    await new Promise<void>((resolve) => {
      const changed = () => {
        if (feedback.getHydrated()) resolve();
      };
      unsubscribe = feedback.subscribe(changed);
      changed();
    });
    return feedback.getSnapshot()[0] ?? null;
  } finally {
    unsubscribe?.();
  }
}
