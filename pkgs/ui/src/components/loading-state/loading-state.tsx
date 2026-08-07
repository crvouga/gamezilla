/**
 * `LoadingState` -- canonical async loading block.
 *
 * Reach for this anywhere you would have hand-rolled a `<SpinnerBox flex:1 />`
 * with an optional caption underneath. Two variants:
 *   - `'fill'`    (default) -- centered Spinner inside `flex: 1`. Use for
 *                              full-screen Suspense fallbacks, screen-level
 *                              loads, and `ScreenBase` body slots.
 *   - `'compact'` -- intrinsic height, padded. Use inline inside a `Card` or
 *                    section.
 *
 * @example
 * ```tsx
 * <Suspense fallback={<LoadingState size="large" />}>{children}</Suspense>
 * <LoadingState caption={t`Loading entity…`} />
 * <LoadingState variant="compact" caption={t`Waiting for metrics…`} />
 * ```
 */

import type { ReactNode } from 'react';

import { type ComponentDataSet, componentDataSet } from '../../component-id';
import { Spinner, type SpinnerProps } from '../spinner';
import { StateBlock, type StateBlockVariant } from '../state-block';
import { Text } from '../text';

export type LoadingStateProps = {
  /** Optional caption rendered under the spinner. */
  caption?: ReactNode;
  /** Layout density. Defaults to `'fill'`. */
  variant?: StateBlockVariant;
  /** Spinner size preset. Defaults to `'medium'`. */
  size?: SpinnerProps['size'];
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

export function LoadingState({
  caption,
  variant = 'fill',
  size = 'medium',
  dataSet,
}: LoadingStateProps): ReactNode {
  return (
    <StateBlock
      variant={variant}
      {...componentDataSet('LoadingState', dataSet)}
    >
      <Spinner size={size} />
      {caption !== undefined && caption !== null ? (
        <Text
          variant="caption"
          sx={{ color: 'textSecondary' }}
          style={{ textAlign: 'center' }}
          label={caption}
        />
      ) : null}
    </StateBlock>
  );
}
