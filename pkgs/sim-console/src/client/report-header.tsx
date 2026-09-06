import { Box, Text } from '@pkgs/ui';
import type { JSX } from 'solid-js';

import { useSimConsoleLayout } from './debugger/use-sim-console-layout';
import {
  appHeaderMiddleSx,
  appHeaderSx,
  appHeaderTrailingSx,
  metaSx,
} from './tokens';

/** Shared top chrome for every simulation-report screen. */
export function ReportHeader(props: {
  readonly leading?: JSX.Element;
  readonly badge?: JSX.Element;
  readonly title?: JSX.Element;
  readonly meta?: JSX.Element;
  readonly end?: JSX.Element;
}) {
  const layout = useSimConsoleLayout();
  const showMeta = () =>
    !layout.compactChrome && props.meta != null && props.meta !== '';
  return (
    <Box sx={appHeaderSx}>
      {props.leading}
      {props.badge}
      <Box sx={appHeaderMiddleSx}>
        {props.title}
        {showMeta() ? (
          <Text sx={[metaSx, { flexShrink: 1, minWidth: 0 }]} numberOfLines={1}>
            {props.meta}
          </Text>
        ) : null}
      </Box>
      {props.end != null ? (
        <Box sx={[appHeaderTrailingSx, { flexShrink: 0 }]}>{props.end}</Box>
      ) : null}
    </Box>
  );
}
