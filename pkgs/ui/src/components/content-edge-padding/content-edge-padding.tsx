/**
 * Edge padding for padded shells ({@link ScreenBase} body,
 * {@link ResponsiveSurface}, padded {@link ModalContent}).
 *
 * Nested {@link ScrollView} / {@link FlatList} cancel horizontal + bottom
 * insets and re-apply them on `contentContainerStyle` so the scrollbar sits
 * flush with the shell edge (padding lives inside the scrollable area).
 */

import { createContext, type ReactNode, useContext } from 'react';
import type { SxProps } from '../../theme';

/**
 * Spacing-scale step (`1` = 4px → 16px) for screen/surface horizontal insets.
 */
export const CONTENT_EDGE_PADDING_STEP = 4;

/**
 * Spacing-scale step (`1` = 4px → 24px) for {@link ResponsiveSurface} bottom
 * inset. Scrollers cancel this so padding sits inside scroll content.
 */
export const SURFACE_BOTTOM_PADDING_STEP = 6;

export type ContentEdgePadding = {
  horizontalStep: number;
  bottomStep: number;
};

const ContentEdgePaddingContext = createContext<ContentEdgePadding | null>(
  null
);

export type ContentEdgePaddingProviderProps = {
  /** Horizontal padding step on the shell (`mx` cancel target). */
  step: number;
  /**
   * Bottom padding step on the shell (`mb` cancel target). Default `0`
   * (horizontal-only flush).
   */
  bottomStep?: number;
  children: ReactNode;
};

export function ContentEdgePaddingProvider({
  step,
  bottomStep = 0,
  children,
}: ContentEdgePaddingProviderProps) {
  return (
    <ContentEdgePaddingContext.Provider
      value={{ horizontalStep: step, bottomStep }}
    >
      {children}
    </ContentEdgePaddingContext.Provider>
  );
}

/** Nearest shell edge padding, or `null` when outside a padded shell. */
export function useContentEdgePadding(): ContentEdgePadding | null {
  return useContext(ContentEdgePaddingContext);
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
