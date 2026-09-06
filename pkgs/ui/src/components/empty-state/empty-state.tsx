/**
 * `EmptyState` -- canonical "no data" block.
 *
 * Reach for this anywhere you would have hand-rolled a centered
 * `<Text variant="body" color="textSecondary">No X yet</Text>`. Pairs an
 * optional icon with a title, body, and primary action so every empty
 * surface in the app has the same affordance vocabulary.
 *
 * @example
 * ```tsx
 * <EmptyState
 *   icon={HouseIcon}
 *   title={<Trans>No live spaces</Trans>}
 *   body={<Trans>Tap + New space to start one.</Trans>}
 *   action={{ label: t`+ New space`, onPress: createSpace }}
 * />
 * <EmptyState variant="compact" title={t`No results match filter.`} />
 * ```
 */

import type { ReactNode } from 'react';

import { type ComponentDataSet, componentDataSet } from '../../component-id';
import { useTheme } from '../../theme';
import { Box } from '../box';
import { Button } from '../button';
import type { IconComponent } from '../icons';
import { StateBlock, type StateBlockVariant } from '../state-block';
import { Text } from '../text';

export type EmptyStateAction = {
  label: ReactNode;
  onPress: () => void;
};

export type EmptyStateProps = {
  /** Optional icon rendered above the title. Tinted with `textSecondary`. */
  icon?: IconComponent;
  title: ReactNode;
  body?: ReactNode;
  /** Optional primary action below the body. */
  action?: EmptyStateAction;
  /** Layout density. Defaults to `'fill'`. */
  variant?: StateBlockVariant;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

const FILL_ICON_SIZE = 28;
const FILL_ICON_DISC = 64;
const COMPACT_ICON_SIZE = 24;
/** Keeps body copy to a readable measure on wide layouts. */
const BODY_MAX_WIDTH = 360;

function EmptyStateIcon({
  icon: Icon,
  variant,
}: {
  icon: IconComponent;
  variant: StateBlockVariant;
}): ReactNode {
  const theme = useTheme();
  if (variant === 'compact') {
    return <Icon size={COMPACT_ICON_SIZE} color={theme.colors.textSecondary} />;
  }
  return (
    <Box
      sx={{
        width: FILL_ICON_DISC,
        height: FILL_ICON_DISC,
        borderRadius: 'full',
        backgroundColor: 'surfaceMuted',
        alignItems: 'center',
        justifyContent: 'center',
        mb: 1,
      }}
    >
      <Icon size={FILL_ICON_SIZE} color={theme.colors.textSecondary} />
    </Box>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  variant = 'fill',
  dataSet,
}: EmptyStateProps): ReactNode {
  const isFill = variant === 'fill';
  return (
    <StateBlock variant={variant} {...componentDataSet('EmptyState', dataSet)}>
      {icon !== undefined ? (
        <EmptyStateIcon icon={icon} variant={variant} />
      ) : null}
      <Text
        variant={isFill ? 'subtitle' : 'bodyBold'}
        sx={{ color: 'text', textAlign: 'center' }}
        label={title}
      />
      {body !== undefined && body !== null ? (
        <Text
          variant={isFill ? 'body' : 'caption'}
          sx={{
            color: 'textSecondary',
            textAlign: 'center',
            maxWidth: BODY_MAX_WIDTH,
          }}
          label={body}
        />
      ) : null}
      {action !== undefined ? (
        <Box sx={{ mt: 2 }}>
          <Button
            title={action.label}
            intent="primary"
            size={isFill ? 'md' : 'sm'}
            onPress={action.onPress}
          />
        </Box>
      ) : null}
    </StateBlock>
  );
}
