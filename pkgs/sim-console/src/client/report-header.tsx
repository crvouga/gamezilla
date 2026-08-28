import { Box, Text } from '@pkgs/ui';
import type { ReactNode } from 'react';

import { useSimConsoleLayout } from './debugger/use-sim-console-layout';
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
  const { compactChrome } = useSimConsoleLayout();
  const showMeta =
    !compactChrome && meta !== undefined && meta !== null && meta !== '';
  return (
    <Box sx={appHeaderSx}>
      {leading}
      {badge}
      <Box sx={appHeaderMiddleSx}>
        {title}
        {showMeta ? (
          <Text sx={[metaSx, { flexShrink: 1, minWidth: 0 }]} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </Box>
      {end != null ? (
        <Box sx={[appHeaderTrailingSx, { flexShrink: 0 }]}>{end}</Box>
      ) : null}
    </Box>
  );
}
