/** @jsxImportSource solid-js */
/**
 * Edge padding for padded shells (`ScreenBase` body, `ResponsiveSurface`,
 * padded `ModalContent`).
 *
 * Nested `ScrollView` / `VirtualList` cancel horizontal + bottom insets and
 * re-apply them on the content container so the scrollbar sits flush with
 * the shell edge (padding lives inside the scrollable area).
 */

import { createContext, type JSX, untrack, useContext } from 'solid-js';
import type { SxProps } from '../../theme';

/** Spacing-scale step (`1` = 4px → 16px) for screen/surface horizontal insets. */
export const CONTENT_EDGE_PADDING_STEP = 4;

/** Spacing-scale step (→ 24px) for `ResponsiveSurface` bottom inset. */
export const SURFACE_BOTTOM_PADDING_STEP = 6;

export type ContentEdgePadding = {
  horizontalStep: number;
  bottomStep: number;
};

const ContentEdgePaddingContext = createContext<ContentEdgePadding>();

export type ContentEdgePaddingProviderProps = {
  /** Horizontal padding step on the shell (`mx` cancel target). */
  step: number;
  /** Bottom padding step on the shell (`mb` cancel target). Default `0`. */
  bottomStep?: number | undefined;
  children: JSX.Element;
};

export function ContentEdgePaddingProvider(
  props: ContentEdgePaddingProviderProps
): JSX.Element {
  // Shell padding is a static layout constant per provider.
  const value = untrack(() => ({
    horizontalStep: props.step,
    bottomStep: props.bottomStep ?? 0,
  }));
  return (
    <ContentEdgePaddingContext.Provider value={value}>
      {props.children}
    </ContentEdgePaddingContext.Provider>
  );
}

/** Nearest shell edge padding, or `null` when outside a padded shell. */
export function useContentEdgePadding(): ContentEdgePadding | null {
  return useContext(ContentEdgePaddingContext) ?? null;
}

/** Nearest shell horizontal padding step, or `null` outside a padded shell. */
export function useContentEdgePaddingStep(): number | null {
  return useContentEdgePadding()?.horizontalStep ?? null;
}

export type FlushEdgeStyles = {
  contentSx: SxProps | undefined;
  wrapperSx: SxProps | undefined;
};

/** Content + wrapper `sx` so a scroller bleeds under shell edge padding. */
export function resolveFlushEdgeStyles(
  edge: ContentEdgePadding | null,
  flushEdge: boolean
): FlushEdgeStyles {
  if (!flushEdge || edge === null) {
    return { contentSx: undefined, wrapperSx: undefined };
  }
  const { horizontalStep, bottomStep } = edge;
  if (horizontalStep === 0 && bottomStep === 0) {
    return { contentSx: undefined, wrapperSx: undefined };
  }
  return {
    contentSx: {
      ...(horizontalStep !== 0 ? { px: horizontalStep } : {}),
      ...(bottomStep !== 0 ? { pb: bottomStep } : {}),
    },
    wrapperSx: {
      minHeight: 0,
      ...(horizontalStep !== 0 ? { mx: -horizontalStep } : {}),
      ...(bottomStep !== 0 ? { mb: -bottomStep } : {}),
    },
  };
}
