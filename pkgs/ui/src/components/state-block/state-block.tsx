/** @jsxImportSource solid-js */
/**
 * `StateBlock` -- layout primitive shared by `LoadingState`, `EmptyState`,
 * `ErrorState`, and `SuccessState`.
 *
 * Renders a vertically-stacked column with consistent gap and centering
 * behavior. Two density variants:
 *   - `'fill'`    -> `flex: 1`, vertically centered on the parent. Used for
 *                    full-screen states (Suspense fallback, empty list page).
 *   - `'compact'` -> intrinsic height with generous padding. Used inline as
 *                    a card or inside a scrolled section.
 *
 * Exported so feature teams can compose custom statuses with the same layout
 * contract (e.g. a payment-failed card with a custom icon set).
 */

import type { JSX } from 'solid-js';
import { type ComponentDataSet, dataAttrs } from '../../component-id';

export type StateBlockVariant = 'fill' | 'compact';

export type StateBlockProps = {
  variant?: StateBlockVariant | undefined;
  children: JSX.Element;
  /** ARIA role for the block (`status`, `alert`, …). */
  role?: 'status' | 'alert' | 'region' | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

export function StateBlock(props: StateBlockProps): JSX.Element {
  const isFill = (): boolean => (props.variant ?? 'fill') === 'fill';
  return (
    <div
      class="box w-full items-center justify-center gap-3 px-5"
      {...dataAttrs({ component: 'StateBlock', ...props.dataSet })}
      style={{
        ...(isFill() ? { flex: 1 } : {}),
        'padding-top': `${(isFill() ? 8 : 6) * 4}px`,
        'padding-bottom': `${(isFill() ? 8 : 6) * 4}px`,
      }}
      role={props.role}
    >
      <div class="box w-full max-w-105 items-center justify-center gap-2">
        {props.children}
      </div>
    </div>
  );
}
