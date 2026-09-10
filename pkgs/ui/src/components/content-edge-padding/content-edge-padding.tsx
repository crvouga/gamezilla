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
import { spacingScale } from '../../theme/scale';
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
  contentClass?: string | undefined;
  contentStyle?: JSX.CSSProperties | undefined;
  wrapperClass?: string | undefined;
};

/** Content + wrapper classes so a scroller bleeds under shell edge padding. */
export function resolveFlushEdgeStyles(
  edge: ContentEdgePadding | null,
  flushEdge: boolean
): FlushEdgeStyles {
  if (!flushEdge || edge === null) {
    return {};
  }
  const { horizontalStep, bottomStep } = edge;
  if (horizontalStep === 0 && bottomStep === 0) {
    return {};
  }
  return {
    contentClass: styles['content'],
    contentStyle: {
      '--ui-flush-edge-x': `${spacingScale(horizontalStep)}px`,
      '--ui-flush-edge-b': `${spacingScale(bottomStep)}px`,
    } as JSX.CSSProperties,
    wrapperClass: styles['wrapper'],
  };
}

/** True when the frame requests flex fill via a `flex-1` utility class. */
export function requestsFlexFill(
  className: string | undefined,
  classList: Record<string, boolean | undefined> | undefined
): boolean {
  if (className !== undefined) {
    for (const part of className.split(/\s+/)) {
      if (part === 'flex-1') return true;
    }
  }
  return classList?.['flex-1'] === true;
}
