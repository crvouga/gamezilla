/**
 * `ModalHeader` -- title area for a modal.
 */

import { Box } from '../box';
import { Text } from '../text';

export type ModalHeaderProps = {
  title: string;
};

export function ModalHeader({ title }: ModalHeaderProps) {
  return (
    <Box sx={{ mb: 3 }}>
      <Text variant="subtitle" label={title} />
    </Box>
  );
}
