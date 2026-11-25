import { type Accessor, createMemo, createSignal, onCleanup } from 'solid-js';
import type {
  MutationFeedback,
  MutationFeedbackScope,
} from './mutation-status';
import { useSyncEngineInstance } from './sync-engine-context';

/** Live, persistent mutation feedback without a feature reading framework tables. */
export function useMutationFeedback(
  mutationName: string | Accessor<string>,
  scope?: Accessor<MutationFeedbackScope>
): Accessor<MutationFeedback | null | undefined> {
  const engine = useSyncEngineInstance();
  // One subscription per name and scope: a change releases the one before it.
  const watch = createMemo(() => {
    const name =
      typeof mutationName === 'string' ? mutationName : mutationName();
    const subscription = engine.mutationFeedback(name, scope?.());
    const [changes, setChanges] = createSignal(0);
    onCleanup(subscription.subscribe(() => setChanges((count) => count + 1)));
    return { subscription, changes };
  });
  return createMemo(() => {
    const { subscription, changes } = watch();
    changes();
    return subscription.getHydrated()
      ? (subscription.getSnapshot()[0] ?? null)
      : undefined;
  });
}
