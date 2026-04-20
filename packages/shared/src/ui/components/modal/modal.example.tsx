import { useState } from 'react';
import { Box } from '../box';
import { Button } from '../button';
import { Stack } from '../stack';
import { Text } from '../text';
import { ConfirmationModal } from './confirmation-modal';

export default function ModalExample() {
  const [defaultOpen, setDefaultOpen] = useState(false);
  const [destructiveOpen, setDestructiveOpen] = useState(false);

  return (
    <Box sx={{ p: 4, gap: 4 }}>
      <Text variant="heading" label="Modal" />

      <Stack spacing={2}>
        <Button
          title="Open Default Modal"
          onPressIn={() => setDefaultOpen(true)}
        />
        <Button
          title="Open Destructive Modal"
          color="destructive"
          onPressIn={() => setDestructiveOpen(true)}
        />
      </Stack>

      <ConfirmationModal
        visible={defaultOpen}
        title="Confirm Action"
        message="Are you sure you want to proceed with this action?"
        onConfirm={() => setDefaultOpen(false)}
        onCancel={() => setDefaultOpen(false)}
      />

      <ConfirmationModal
        visible={destructiveOpen}
        title="Delete Item?"
        message="This action cannot be undone. The item will be permanently removed."
        variant="destructive"
        confirmLabel="Delete"
        onConfirm={() => setDestructiveOpen(false)}
        onCancel={() => setDestructiveOpen(false)}
      />
    </Box>
  );
}
