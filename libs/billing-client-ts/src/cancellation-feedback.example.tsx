import type { CancellationFeedback } from '@libs/billing-shared-ts/cancellation-feedback';
import { createSignal } from 'solid-js';
import { CancellationFeedbackForm } from './cancellation-feedback-form';

/** Deterministic feedback state for the real billing screen's stories. */
export function CancellationFeedbackExample(props: {
  readonly online?: boolean;
  readonly fail?: boolean;
  readonly saved?: CancellationFeedback;
}) {
  const [saved, setSaved] = createSignal<CancellationFeedback | null>(
    props.saved ?? null
  );
  return (
    <CancellationFeedbackForm
      saved={saved()}
      online={props.online ?? true}
      onSave={async (answer) => {
        if (props.fail)
          throw new Error('Feedback storage is temporarily unavailable');
        setSaved(answer);
      }}
    />
  );
}
