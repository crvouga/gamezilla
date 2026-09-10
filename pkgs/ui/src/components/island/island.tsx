/** @jsxImportSource solid-js */
/**
 * `Island` -- content tile for the wide app shell. On compact layouts it is a
 * transparent pass-through so screens keep their mobile spacing.
 */

import { type JSX, Show, splitProps } from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import {
  ISLAND_PADDING_STEP,
  ISLAND_RADIUS,
  spacingScale,
  useLayoutMode,
} from '../../theme';
import { Box, joinClass } from '../box';
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
  class?: string | undefined;
  style?: JSX.CSSProperties | undefined;
  children?: JSX.Element | undefined;
  dataSet?: ComponentDataSet | undefined;
};

function IslandTitleRow(props: {
  title: JSX.Element;
  caption: JSX.Element | undefined;
  actions: JSX.Element | undefined;
}): JSX.Element {
  return (
    <Box class="flex-row items-center gap-2 mb-3">
      <Box class="flex-1 min-w-0 gap-0.5">
        <Text variant="subtitle" as="h2" label={props.title} />
        <Show when={props.caption !== undefined && props.caption !== null}>
          <Text
            variant="caption"
            class="text-text-secondary"
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
      class={joinClass(
        'bg-surface-elevated border border-solid border-border overflow-hidden',
        props.class
      )}
      style={{
        'border-radius': `${ISLAND_RADIUS}px`,
        padding: `${spacingScale(ISLAND_PADDING_STEP)}px`,
        'grid-column': `span ${props.span ?? 1}`,
        ...props.style,
      }}
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
  const [local, rest] = splitProps(props, [
    'title',
    'caption',
    'actions',
    'span',
    'class',
    'style',
    'children',
    'dataSet',
  ]);
  return (
    <Show
      when={mode() === 'wide'}
      fallback={
        <Box
          class={local.class}
          style={local.style}
          dataSet={{ component: 'Island', ...local.dataSet }}
        >
          {local.children}
        </Box>
      }
    >
      <IslandWide {...local} {...rest} />
    </Show>
  );
}
