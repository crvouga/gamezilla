import { Box, Text } from '@pkgs/ui';
import type { ReactNode } from 'react';

import {
  appHeaderMiddleSx,
  appHeaderSx,
  appHeaderTrailingSx,
  metaSx,
} from './tokens';

/** Shared top chrome for every simulation-report screen. */
export function ReportHeader(props: {
  readonly leading?: ReactNode;
  readonly badge?: ReactNode;
  readonly title?: ReactNode;
  readonly meta?: ReactNode;
  readonly end?: ReactNode;
}) {
  const { leading, badge, title, meta, end } = props;
  return (
    <Box sx={appHeaderSx}>
      {leading}
      {badge}
      <Box sx={appHeaderMiddleSx}>
        {title}
        {meta !== undefined && meta !== null && meta !== '' ? (
          <Text sx={[metaSx, { flexShrink: 0 }]} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </Box>
      {end != null ? <Box sx={appHeaderTrailingSx}>{end}</Box> : null}
    </Box>
  );
}
