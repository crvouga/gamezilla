/**
 * `PickerSection` — labeled vertical block for inline editor pickers.
 */

import type { ReactNode } from 'react';
import { Box } from '../box';
import { Text } from '../text';

export type PickerSectionProps = {
  label: ReactNode;
  children: ReactNode;
  description?: ReactNode;
};

export function PickerSection({
  label,
  children,
  description,
}: PickerSectionProps) {
  return (
    <Box sx={{ gap: 2, py: 1 }}>
      <Text variant="label" label={label} />
      {description !== undefined ? (
        <Text variant="caption" sx={{ opacity: 0.75 }} label={description} />
      ) : null}
      {children}
    </Box>
  );
}
