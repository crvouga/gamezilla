import type { ReactNode } from 'react';

import { componentDataSet, type ComponentDataSet } from '../../component-id';
import { Box } from '../box';
import { Text } from '../text';

export type MainMenuScreenHeaderProps = {
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

/** Shared title and subtitle treatment for screens inside a main-menu flow. */
export function MainMenuScreenHeader({
  title,
  subtitle,
  dataSet,
}: MainMenuScreenHeaderProps): ReactNode {
  if (title === undefined && subtitle === undefined) {
    return null;
  }

  return (
    <Box
      {...componentDataSet('MainMenuScreenHeader', dataSet)}
      sx={{ gap: 1, alignItems: 'center', py: 2 }}
    >
      {title !== undefined ? (
        <Text variant="heading" sx={{ textAlign: 'center' }} label={title} />
      ) : null}
      {subtitle !== undefined ? (
        <Text
          variant="body"
          sx={{
            color: 'textSecondary',
            textAlign: 'center',
            opacity: 0.75,
          }}
          label={subtitle}
        />
      ) : null}
    </Box>
  );
}
