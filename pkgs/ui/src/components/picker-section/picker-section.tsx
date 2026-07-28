/**
 * `PickerSection` — labeled vertical block for inline editor pickers.
 */

import type { ReactNode } from 'react';
import { componentDataSet, type ComponentDataSet } from '../../component-id';
import { Box } from '../box';
import { Text } from '../text';

export type PickerSectionProps = {
  label: ReactNode;
  children: ReactNode;
  description?: ReactNode;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

export function PickerSection({
  label,
  children,
  description,
  dataSet,
}: PickerSectionProps) {
  return (
    <Box sx={{ gap: 2, py: 1 }} {...componentDataSet('PickerSection', dataSet)}>
      <Text variant="label" label={label} />
      {description !== undefined ? (
        <Text variant="caption" sx={{ opacity: 0.75 }} label={description} />
      ) : null}
      {children}
    </Box>
  );
}
