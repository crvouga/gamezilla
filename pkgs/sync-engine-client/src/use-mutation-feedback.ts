import {
  type Accessor,
  createComputed,
  createSignal,
  onCleanup,
} from 'solid-js';
import type { MutationFeedback, MutationFeedbackScope } from './mutation-status';
import { useSyncEngineInstance } from './sync-engine-context';

/** Live, persistent mutation feedback without a feature reading framework tables. */
export function useMutationFeedback(
  mutationName: string | Accessor<string>,
  scope?: Accessor<MutationFeedbackScope>
): Accessor<MutationFeedback | null> {
  const engine = useSyncEngineInstance();
  const [feedback, setFeedback] = createSignal<MutationFeedback | null>(null);
  createComputed(() => {
    const name =
      typeof mutationName === 'string' ? mutationName : mutationName();
    const subscription = engine.mutationFeedback(name, scope?.());
    const apply = (): void => {
      setFeedback(subscription.getSnapshot()[0] ?? null);
    };
    apply();
    onCleanup(subscription.subscribe(apply));
  });
  return feedback;
}
