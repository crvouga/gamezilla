import { Box, Text } from '@pkgs/ui';
import type { ReactNode } from 'react';

import { appHeaderSx, appHeaderTrailingSx, metaSx } from './tokens';

/** Shared top chrome for every simulation-report screen. */
export function ReportHeader(props: {
  readonly badge?: ReactNode;
  readonly meta?: ReactNode;
  readonly end?: ReactNode;
}) {
  const { badge, meta, end } = props;
  return (
    <Box sx={appHeaderSx}>
      {badge}
      {meta !== undefined && meta !== null && meta !== '' ? (
        <Text sx={metaSx}>{meta}</Text>
      ) : null}
      {end != null ? <Box sx={appHeaderTrailingSx}>{end}</Box> : null}
    </Box>
  );
}
