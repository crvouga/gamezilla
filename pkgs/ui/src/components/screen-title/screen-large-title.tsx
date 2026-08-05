/**
 * Large body heading for screens using {@link ScreenBase} `largeTitle`.
 * Scroll past {@link SCREEN_TITLE_REVEAL_OFFSET} to reveal the TopBar title.
 */

import type { ReactNode } from 'react';

import { componentDataSet, type ComponentDataSet } from '../../component-id';
import { Box } from '../box';
import { Text } from '../text';
import { useScreenTitleContext } from './screen-title-context';

export type ScreenLargeTitleProps = {
  /** Defaults to the ScreenBase last-breadcrumb title when provided. */
  label?: ReactNode;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

export function ScreenLargeTitle({
  label,
  dataSet,
}: ScreenLargeTitleProps): ReactNode {
  const ctx = useScreenTitleContext();
  const resolved = label ?? ctx?.title;
  if (resolved === undefined || resolved === null) {
    throw new Error(
      'ScreenLargeTitle requires `label` or ScreenBase `largeTitle`'
    );
  }

  return (
    <Box
      sx={{ pt: 3, mb: 4 }}
      {...componentDataSet('ScreenLargeTitle', dataSet)}
    >
      <Text
        accessibilityRole="header"
        aria-level={1}
        variant="title"
        label={resolved}
      />
    </Box>
  );
}
