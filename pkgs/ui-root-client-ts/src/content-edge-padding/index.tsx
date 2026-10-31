/** @jsxImportSource solid-js */

import { spacingScale } from '@pkgs/ui-root-shared-ts/scale';
import { createContext, type JSX, untrack, useContext } from 'solid-js';
import styles from './content-edge-padding.module.css';

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

/**
 * Edge padding for padded shells (`ScreenBase` body, `ResponsiveSurface`,
 * padded `ModalContent`).
 *
 * Nested `ScrollView` / `VirtualList` cancel horizontal + bottom insets and
 * re-apply them on the content container so the scrollbar sits flush with
 * the shell edge (padding lives inside the scrollable area).
 */
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

/** What a flush-edge scroller needs: content padding and the bleed wrapper. */
export type FlushEdgeStyles = {
  contentClass?: string | undefined;
  contentStyle?: JSX.CSSProperties | undefined;
  wrapperClass?: string | undefined;
};

export type FlushEdgeOptions = {
  /** Cancel the shell's edge padding at all. */
  flushEdge: boolean;
  /** Re-apply the side padding inside the scroller (else rows run edge to edge). */
  inset: boolean;
};

/** Content + wrapper classes so a scroller bleeds under shell edge padding. */
export function resolveFlushEdgeStyles(
  edge: ContentEdgePadding | null,
  options: FlushEdgeOptions
): FlushEdgeStyles {
  if (!options.flushEdge || edge === null) {
    return {};
  }
  const { horizontalStep, bottomStep } = edge;
  if (horizontalStep === 0 && bottomStep === 0) {
    return {};
  }
  const edgeX = `${spacingScale(horizontalStep)}px`;
  return {
    contentClass: styles['content'],
    contentStyle: {
      '--ui-flush-edge-x': edgeX,
      '--ui-flush-inset-x': options.inset ? edgeX : '0px',
      '--ui-flush-edge-b': `${spacingScale(bottomStep)}px`,
    },
    wrapperClass: styles['wrapper'],
  };
}
