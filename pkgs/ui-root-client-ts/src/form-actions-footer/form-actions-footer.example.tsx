/** @jsxImportSource solid-js */
import { useTimers } from '@pkgs/clock-client-ts/solid';
import { FormActionsFooter } from '@pkgs/ui-root-client-ts/form-actions-footer';
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { SchemePreview } from '../../storybook/fixtures/scheme-preview';

const SAVE_DEMO_MS = 900;

const SUBMIT_LABELS = {
  label: 'Save',
  loadingLabel: 'Saving…',
  successLabel: 'Saved',
  errorLabel: "Couldn't save",
};

export default function FormActionsFooterExample(): JSX.Element {
  const timers = useTimers();
  const delay = (ms: number): Promise<void> =>
    new Promise<void>((resolve) => {
      timers.setTimeout(resolve, ms);
    });
  const save = (): Promise<void> => delay(SAVE_DEMO_MS);
  const failingSave = async (): Promise<void> => {
    await delay(SAVE_DEMO_MS);
    throw new Error('Network unreachable');
  };
  return (
    <ExampleRoot>
      <p class="text textCaption text-text-secondary">
        {
          "Save runs through useMutationButton: Saving… -> Saved (or retryable error). On mobile, pin this to the bottom via ScreenBase's footer slot."
        }
      </p>
      <label class="text textLabel text-text-secondary">{'Succeeds'}</label>
      <SchemePreview>
        <FormActionsFooter
          cancel={{ label: 'Cancel', onClick: () => undefined }}
          submit={{ ...SUBMIT_LABELS, operation: save }}
        />
      </SchemePreview>
      <label class="text textLabel text-text-secondary">{'Fails'}</label>
      <SchemePreview>
        <FormActionsFooter
          cancel={{ label: 'Cancel', onClick: () => undefined }}
          submit={{ ...SUBMIT_LABELS, operation: failingSave }}
        />
      </SchemePreview>
    </ExampleRoot>
  );
}
