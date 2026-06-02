import { useCallback } from 'react';
import { Box } from '../box';
import { SchemePreview } from '../explorer/scheme-preview';
import { Text } from '../text';
import { FormActionsFooter } from './form-actions-footer';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function FormActionsFooterExample() {
  const save = useCallback(() => delay(900), []);
  const failingSave = useCallback(async () => {
    await delay(900);
    throw new Error('Network unreachable');
  }, []);
  return (
    <Box sx={{ p: 4, gap: 4 }}>
      <Text variant="heading" label="FormActionsFooter" />
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
    </Box>
  );
}
