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
import type { ComponentDataSet } from '../../component-id';
import { Box } from '../box';

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
    <Box
      role={props.role}
      dataSet={{ component: 'StateBlock', ...props.dataSet }}
      sx={[
        isFill() && { flex: 1 },
        {
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          px: 5,
          py: isFill() ? 8 : 6,
        },
      ]}
    >
      <Box sx={{ alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        {props.children}
      </Box>
    </Box>
  );
}
