/**
 * `ErrorState` -- canonical failure block.
 *
 * Reach for this anywhere you would have hand-rolled a destructive `Text`
 * inside a padded `Box`, or a tinted "ErrorCard" with `destructive` border
 * + `destructiveSurface` fill. Pairs an icon with a title, optional body
 * (typically the raw error message), and optional retry button.
 *
 * Variants:
 *   - `'fill'`    (default) -- centered failure inside `flex: 1`. Use for
 *                              boot failures and full-screen errors.
 *   - `'compact'` -- destructive-tinted card with a left-aligned icon row,
 *                    sized to inline content (replaces ad-hoc ErrorCards).
 *
 * @example
 * ```tsx
 * <ErrorState title={t`Playground failed to start`} body={boot.bootErr} />
 * <ErrorState variant="compact" title={t`Failed to load metrics`} body={msg} />
 * ```
 */

import type { ReactNode } from 'react';

import { type ComponentDataSet, componentDataSet } from '../../component-id';
import { useTheme } from '../../theme';
import { borderRadius } from '../../theme/scale';
import { Box } from '../box';
import { Button } from '../button';
import { type IconComponent, XIcon } from '../icons';
import { StateBlock, type StateBlockVariant } from '../state-block';
import { Text } from '../text';

export type ErrorStateRetry = {
  label?: ReactNode;
  onPress: () => void;
};

export type ErrorStateProps = {
  /** Defaults to the X mark from the design-system icon set. */
  icon?: IconComponent;
  title: ReactNode;
  /** Error detail (string, LocalizedString, or any node). */
  body?: ReactNode;
  /** Optional retry action button. */
  retry?: ErrorStateRetry;
  /** Layout density. Defaults to `'fill'`. */
  variant?: StateBlockVariant;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

const ICON_SIZE_FILL = 32;
const ICON_SIZE_COMPACT = 20;
const DEFAULT_ICON = XIcon;

export function ErrorState({
  icon = DEFAULT_ICON,
  title,
  body,
  retry,
  variant = 'fill',
  dataSet,
}: ErrorStateProps): ReactNode {
  if (variant === 'compact') {
    return (
      <ErrorStateCompact
        icon={icon}
        title={title}
        body={body}
        retry={retry}
        dataSet={dataSet}
      />
    );
  }
  return (
    <ErrorStateFill
      icon={icon}
      title={title}
      body={body}
      retry={retry}
      dataSet={dataSet}
    />
  );
}

function ErrorStateFill({
  icon,
  title,
  body,
  retry,
  dataSet,
}: {
  icon: IconComponent;
  title: ReactNode;
  body: ReactNode;
  retry: ErrorStateRetry | undefined;
  dataSet: ComponentDataSet | undefined;
}) {
  const theme = useTheme();
  const Icon = icon;
  return (
    <StateBlock variant="fill" {...componentDataSet('ErrorState', dataSet)}>
      <Icon size={ICON_SIZE_FILL} color={theme.colors.destructive} />
      <Text
        variant="bodyBold"
        sx={{ color: 'destructive' }}
        style={{ textAlign: 'center' }}
        label={title}
      />
      {body !== undefined && body !== null ? (
        <Text
          variant="caption"
          sx={{ color: 'textSecondary' }}
          style={{ textAlign: 'center' }}
          label={body}
        />
      ) : null}
      {retry !== undefined ? <ErrorRetryButton retry={retry} /> : null}
    </StateBlock>
  );
}

function ErrorStateCompact({
  icon,
  title,
  body,
  retry,
  dataSet,
}: {
  icon: IconComponent;
  title: ReactNode;
  body: ReactNode;
  retry: ErrorStateRetry | undefined;
  dataSet: ComponentDataSet | undefined;
}) {
  const theme = useTheme();
  const Icon = icon;
  return (
    <Box
      {...componentDataSet('ErrorState', dataSet)}
      sx={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 3,
        p: 3,
        borderWidth: 1,
        borderColor: 'destructive',
        background: 'destructiveSurface',
        borderRadius: borderRadius.md,
      }}
    >
      <Box sx={{ pt: 0.5 }}>
        <Icon size={ICON_SIZE_COMPACT} color={theme.colors.destructive} />
      </Box>
      <Box sx={{ flex: 1, gap: 1 }}>
        <Text variant="bodyBold" sx={{ color: 'destructive' }} label={title} />
        {body !== undefined && body !== null ? (
          <Text variant="caption" sx={{ color: 'destructive' }} label={body} />
        ) : null}
        {retry !== undefined ? (
          <Box sx={{ mt: 1, alignItems: 'flex-start' }}>
            <ErrorRetryButton retry={retry} />
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}

function ErrorRetryButton({ retry }: { retry: ErrorStateRetry }) {
  return (
    <Button
      title={retry.label ?? 'Retry'}
      intent="danger"
      variant="outline"
      size="sm"
      onPress={retry.onPress}
    />
  );
}
