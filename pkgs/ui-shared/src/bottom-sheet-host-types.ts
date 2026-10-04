/**
 * Injectable bottom-sheet surface used by {@link ResponsiveSurface} and app
 * portal chrome. On the web there is exactly one real implementation
 * ({@link createWebBottomSheetHost}); the passthrough host exists for trees
 * that must not mount overlay chrome at all.
 */

import type { Component, JSX } from 'solid-js';
import type { ComponentDataSet } from './component-id';

export type BottomSheetHostSheetProps = {
  /** Mount + slide the sheet in while `true`; unmount when `false`. */
  open: boolean;
  /** Backdrop click / Escape (topmost surface only) / handle dismiss. */
  onClose: () => void;
  /**
   * Stable surface-stack id. Defaults to a generated unique id; pass a
   * constant for sheets that remount while overlays stay open.
   */
  stackId?: string | undefined;
  /** Accessible name fallback when no header renders a surface title. */
  label?: string | undefined;
  /**
   * Fixed panel height in px. When omitted the sheet hugs its content, capped
   * at 90% of the layout height.
   */
  height?: number | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
  children?: JSX.Element | undefined;
};

export type BottomSheetHost = {
  /** Renders `children` inside a bottom sheet while `open`. */
  readonly Sheet: Component<BottomSheetHostSheetProps>;
  /**
   * When `false`, {@link ResponsiveSurface} never uses the sheet path
   * (passthrough hosts mount content in place with no backdrop).
   */
  readonly supportsSheetPresentation: boolean;
};
