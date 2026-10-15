import {
  type Accessor,
  createComputed,
  createSignal,
  onCleanup,
} from 'solid-js';
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
  const [feedback, setFeedback] = createSignal<
    MutationFeedback | null | undefined
  >();
  createComputed(() => {
    const name =
      typeof mutationName === 'string' ? mutationName : mutationName();
    const subscription = engine.mutationFeedback(name, scope?.());
    const apply = (): void => {
      setFeedback(
        subscription.getHydrated()
          ? (subscription.getSnapshot()[0] ?? null)
          : undefined
      );
    };
    apply();
    onCleanup(subscription.subscribe(apply));
  });
  return feedback;
}
