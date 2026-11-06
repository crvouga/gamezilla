import type { Accessor } from 'solid-js';
import { SCREEN_MAX_WIDTH, type ScreenMeasure } from './screen-measure';
import { useLayoutMode } from './use-layout-mode';

export type ResolvedScreenMeasure = {
  /** CSS max-width, or `undefined` for the whole column. */
  maxWidth: string | undefined;
  /** Center the capped column in the space it has. */
  centered: boolean;
};

/**
 * How a screen measure lands at the current layout.
 *
 * Compact (phones, tablets): every measure caps the column and centers it,
 * so a tablet never shows a column hugging one edge.
 *
 * Wide (desktop): every screen starts at the frame column's leading edge,
 * the edge an open space's top bar uses, so the content never jumps
 * sideways between screens. Menus and collections take the whole column
 * and compose it (sections lay their label beside their rows, collections
 * add a context panel); only `prose` keeps a reading measure.
 */
export function useScreenMeasure(
  measure: () => ScreenMeasure | undefined
): Accessor<ResolvedScreenMeasure> {
  const mode = useLayoutMode();
  return () => {
    const m = measure();
    if (m === undefined) return { maxWidth: undefined, centered: false };
    if (mode() === 'compact') {
      return { maxWidth: SCREEN_MAX_WIDTH[m], centered: true };
    }
    return {
      maxWidth: m === 'prose' ? SCREEN_MAX_WIDTH.prose : undefined,
      centered: false,
    };
  };
}
