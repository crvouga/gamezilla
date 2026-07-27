/**
 * `ModalBody` -- text content area for a modal.
 */

import type { PropsWithChildren, ReactNode } from 'react';
import {
  componentDataSet,
  type ComponentDataSet,
} from '../../component-id';
import { Box } from '../box';
import { Text } from '../text';

export type ModalBodyProps = PropsWithChildren<{
  message?: ReactNode;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
}>;

export function ModalBody({ message, children, dataSet }: ModalBodyProps) {
  return (
    <Box {...componentDataSet('ModalBody', dataSet)} sx={{ mb: 4 }}>
      {message ? <Text variant="body" label={message} /> : children}
    </Box>
  );
}
