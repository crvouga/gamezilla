import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { useState } from 'react';
import { Box } from '../box';
import { Button } from '../button';
import { Stack } from '../stack';
import { Text } from '../text';
import { TextInput } from '../text-input';
import { MutationModal } from './mutation-modal';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ConfirmExample() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        title="Open confirm (succeeds)"
        intent="danger"
        onPress={() => setOpen(true)}
      />
      <MutationModal
        visible={open}
        onClose={() => setOpen(false)}
        title="End space?"
        message="Everyone will leave this space. This cannot be undone."
        submitLabel="End space"
        variant="destructive"
        operation={async () => {
          await delay(900);
        }}
        loadingLabel="Ending space…"
        successTitle="Space ended"
        successBody="Everyone has been returned to the lobby."
      />
    </>
  );
}

function ErrorExample() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button title="Open confirm (fails)" onPress={() => setOpen(true)} />
      <MutationModal
        visible={open}
        onClose={() => setOpen(false)}
        title="Leave space?"
        message="You can join again later if the space is still live."
        submitLabel="Leave"
        operation={async () => {
          await delay(900);
          throw new Error('Network unreachable — please retry.');
        }}
        loadingLabel="Leaving…"
        successTitle="You left the space"
      />
    </>
  );
}

function FormExample() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  return (
    <>
      <Button title="Open form mutation" onPress={() => setOpen(true)} />
      <MutationModal
        visible={open}
        onClose={() => setOpen(false)}
        title="Rename space"
        submitLabel="Save"
        submitDisabled={value.trim().length === 0}
        operation={async () => {
          await delay(700);
        }}
        loadingLabel="Saving…"
        successTitle="Renamed"
      >
        <TextInput
          label={<Trans>Space name</Trans>}
          value={value}
          onChangeText={setValue}
          placeholder={t`Give your space a name`}
          autoFocus
        />
      </MutationModal>
    </>
  );
}

export default function MutationModalExample() {
  return (
    <Box sx={{ p: 4, gap: 4 }}>
      <Text variant="heading" label="MutationModal" />
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label="Submit transitions through loading -> success / error in place. Success is dismissible; errors are retryable."
      />
      <Stack spacing={2}>
        <ConfirmExample />
        <ErrorExample />
        <FormExample />
      </Stack>
    </Box>
  );
}
