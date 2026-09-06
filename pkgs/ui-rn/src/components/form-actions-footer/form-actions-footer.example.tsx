import { useTimers } from '@pkgs/clock';
import { useCallback } from 'react';
import { ExampleRoot } from '../explorer/example-root';
import { SchemePreview } from '../explorer/scheme-preview';
import { Text } from '../text';
import { FormActionsFooter } from './form-actions-footer';

export default function FormActionsFooterExample() {
  const timers = useTimers();
  const delay = useCallback(
    (ms: number) =>
      new Promise<void>((resolve) => {
        timers.setTimeout(resolve, ms);
      }),
    [timers]
  );
  const save = useCallback(() => delay(900), [delay]);
  const failingSave = useCallback(async () => {
    await delay(900);
    throw new Error('Network unreachable');
  }, [delay]);
  return (
    <ExampleRoot>
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label="Save runs through useMutationButton: Saving… -> Saved (or retryable error). On mobile, pin this to the bottom via ScreenBase's footer slot."
      />
      <Text variant="label" sx={{ color: 'textSecondary' }} label="Succeeds" />
      <SchemePreview>
        <FormActionsFooter
          cancel={{ label: 'Cancel', onPress: () => {} }}
          submit={{
            label: 'Save',
            loadingLabel: 'Saving…',
            successLabel: 'Saved',
            errorLabel: "Couldn't save",
            operation: save,
          }}
        />
      </SchemePreview>
      <Text variant="label" sx={{ color: 'textSecondary' }} label="Fails" />
      <SchemePreview>
        <FormActionsFooter
          cancel={{ label: 'Cancel', onPress: () => {} }}
          submit={{
            label: 'Save',
            loadingLabel: 'Saving…',
            successLabel: 'Saved',
            errorLabel: "Couldn't save",
            operation: failingSave,
          }}
        />
      </SchemePreview>
    </ExampleRoot>
  );
}
