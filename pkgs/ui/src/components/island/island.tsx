/** @jsxImportSource solid-js */
/**
 * `Island` -- content tile for the wide app shell. On compact layouts it is a
 * transparent pass-through so screens keep their mobile spacing.
 */

import { type JSX, Show } from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import {
  ISLAND_PADDING_STEP,
  ISLAND_RADIUS,
  type SxInput,
  useLayoutMode,
} from '../../theme';
import { Box } from '../box';
import { ContentEdgePaddingProvider } from '../content-edge-padding';
import { Text } from '../text';

export type IslandSpan = 1 | 2 | 3;

export type IslandProps = {
  title?: JSX.Element | undefined;
  caption?: JSX.Element | undefined;
  /** Trailing actions in the title row (wide only). */
  actions?: JSX.Element | undefined;
  /** Columns spanned inside an `IslandGrid` (wide only). Defaults to 1. */
  span?: IslandSpan | undefined;
  sx?: SxInput | undefined;
  children?: JSX.Element | undefined;
  dataSet?: ComponentDataSet | undefined;
};

function IslandTitleRow(props: {
  title: JSX.Element;
  caption: JSX.Element | undefined;
  actions: JSX.Element | undefined;
}): JSX.Element {
  return (
    <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 2, mb: 3 }}>
      <Box sx={{ flex: 1, minWidth: 0, gap: 0.5 }}>
        <Text variant="subtitle" as="h2" label={props.title} />
        <Show when={props.caption !== undefined && props.caption !== null}>
          <Text
            variant="caption"
            sx={{ color: 'textSecondary' }}
            label={props.caption}
          />
        </Show>
      </Box>
      {props.actions}
    </Box>
  );
}

function IslandWide(props: IslandProps): JSX.Element {
  const hasTitle = () => props.title !== undefined && props.title !== null;
  return (
    <Box
      as="section"
      sx={[
        {
          backgroundColor: 'surfaceElevated',
          borderRadius: ISLAND_RADIUS,
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: 'border',
          elevation: 1,
          overflow: 'hidden',
          p: ISLAND_PADDING_STEP,
          gridColumn: `span ${props.span ?? 1}`,
        },
        props.sx,
      ]}
      dataSet={{ component: 'Island', ...props.dataSet }}
    >
      <ContentEdgePaddingProvider step={ISLAND_PADDING_STEP}>
        <Show when={hasTitle()}>
          <IslandTitleRow
            title={props.title}
            caption={props.caption}
            actions={props.actions}
          />
        </Show>
        {props.children}
      </ContentEdgePaddingProvider>
    </Box>
  );
}

export function Island(props: IslandProps): JSX.Element {
  const mode = useLayoutMode();
  return (
    <Show
      when={mode() === 'wide'}
      fallback={
        <Box sx={props.sx} dataSet={{ component: 'Island', ...props.dataSet }}>
          {props.children}
        </Box>
      }
    >
      <IslandWide {...props} />
    </Show>
  );
}
