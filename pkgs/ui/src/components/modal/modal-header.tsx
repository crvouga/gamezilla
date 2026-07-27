/**
 * `ModalHeader` -- title area for a modal.
 */

import {
  componentDataSet,
  type ComponentDataSet,
} from '../../component-id';
import { Box } from '../box';
import { Text } from '../text';

export type ModalHeaderProps = {
  title: string;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

export function ModalHeader({ title, dataSet }: ModalHeaderProps) {
  return (
    <Box {...componentDataSet('ModalHeader', dataSet)} sx={{ mb: 3 }}>
      <Text variant="subtitle" label={title} />
    </Box>
  );
}
