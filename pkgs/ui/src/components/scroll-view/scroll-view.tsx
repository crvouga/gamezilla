/** @jsxImportSource solid-js */
/**
 * `ScrollView` -- overflow-auto scroller with a flex content container.
 *
 * `frameSx` styles the scroller (flex, maxHeight, …); `sx` styles the content
 * container. Inside a padded shell the scroller bleeds under the shell's edge
 * padding (`flushEdge`) so the scrollbar sits flush with the frame.
 */

import { type JSX, Show, splitProps } from 'solid-js';
import { type ComponentDataSet, componentDataAttrs } from '../../component-id';
import { flattenSx, type SxInput, useThemeTokens } from '../../theme';
import { Box, joinClass } from '../box/box';
import {
  resolveFlushEdgeStyles,
  useContentEdgePadding,
} from '../content-edge-padding';
import styles from '../hosts.module.css';

export type ScrollViewProps = Omit<
  JSX.HTMLAttributes<HTMLDivElement>,
  'style' | 'children'
> & {
  /** Utility-first style shorthand applied to the content container. */
  sx?: SxInput | undefined;
  /** Style the scroller frame (flex, maxHeight, …). */
  frameSx?: SxInput | undefined;
  /** Scroll along the x axis instead. */
  horizontal?: boolean | undefined;
  /** Hide the scrollbar (still scrollable). */
  hideScrollbar?: boolean | undefined;
  /**
   * When inside a padded shell, cancel edge padding so the scrollbar is flush.
   * Default `true`.
   */
  flushEdge?: boolean | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
  class?: string | undefined;
  /** Scroller element ref (call `scrollTo` / read `scrollTop`). */
  ref?: ((el: HTMLDivElement) => void) | undefined;
  children?: JSX.Element | undefined;
};

function requestsFlexFill(frameSx: SxInput): boolean {
  const flat = flattenSx(frameSx);
  return flat?.flex === 1 || flat?.flexGrow === 1;
}

export function ScrollView(props: ScrollViewProps): JSX.Element {
  const tokens = useThemeTokens();
  const edge = useContentEdgePadding();
  const [local, rest] = splitProps(props, [
    'sx',
    'frameSx',
    'horizontal',
    'hideScrollbar',
    'flushEdge',
    'dataSet',
    'class',
    'children',
  ]);
  const flush = () => resolveFlushEdgeStyles(edge, local.flushEdge ?? true);
  const scroller = (
    <div
      class={joinClass(
        styles['scroll'],
        local.horizontal && styles['scrollHorizontal'],
        local.hideScrollbar && styles['scrollHideBar'],
        local.class
      )}
      style={tokens.css(local.frameSx) || undefined}
      {...componentDataAttrs('ScrollView', local.dataSet)}
      {...rest}
    >
      <div
        class={joinClass(
          styles['scrollContent'],
          local.horizontal && styles['scrollContentHorizontal']
        )}
        style={tokens.css([flush().contentSx, local.sx]) || undefined}
        data-component="ScrollViewContent"
      >
        {local.children}
      </div>
    </div>
  );
  return (
    <Show when={flush().wrapperSx} fallback={scroller}>
      {(wrapperSx) => (
        <Box
          sx={
            requestsFlexFill(local.frameSx)
              ? { ...wrapperSx(), flex: 1 }
              : wrapperSx()
          }
        >
          {scroller}
        </Box>
      )}
    </Show>
  );
}
