/**
 * `StateBlock` -- internal layout primitive shared by `LoadingState`,
 * `EmptyState`, `ErrorState`, and `SuccessState`.
 *
 * Renders a vertically-stacked column with consistent gap, max-width, and
 * centering behavior. Two density variants:
 *   - `'fill'`    -> `flex: 1`, vertically centered on the parent. Used for
 *                    full-screen states (Suspense fallback, empty list page).
 *   - `'compact'` -> intrinsic height with generous padding. Used inline as
 *                    a card or inside a scrolled section.
 *
 * Exported from `@pkgs/ui` so feature teams can compose custom statuses
 * with the same layout contract (e.g. a payment-failed card with a custom
 * icon set).
 */

import type { ReactNode } from 'react';

import { Box } from '../box';

export type StateBlockVariant = 'fill' | 'compact';

export type StateBlockProps = {
  variant?: StateBlockVariant;
  children: ReactNode;
};

const MAX_CONTENT_WIDTH = 360;

export function StateBlock({
  variant = 'fill',
  children,
}: StateBlockProps): ReactNode {
  const isFill = variant === 'fill';
  return (
    <Box
      sx={{
        ...(isFill ? { flex: 1 } : {}),
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        px: 5,
        py: isFill ? 8 : 6,
      }}
    >
      <Box
        sx={{
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          maxWidth: MAX_CONTENT_WIDTH,
        }}
        style={{ width: '100%' }}
      >
        {children}
      </Box>
    </Box>
  );
}
