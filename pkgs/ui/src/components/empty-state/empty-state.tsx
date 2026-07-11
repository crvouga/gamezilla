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

import { useTheme } from '../../theme';
import { Button } from '../button';
import { StateBlock, type StateBlockVariant } from '../state-block';
import { type IconComponent } from '../icons';
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
};

const ICON_SIZE = 32;

export function EmptyState({
  icon,
  title,
  body,
  action,
  variant = 'fill',
}: EmptyStateProps): ReactNode {
  const theme = useTheme();
  const Icon = icon;
  return (
    <StateBlock variant={variant}>
      {Icon !== undefined ? (
        <Icon size={ICON_SIZE} color={theme.colors.textSecondary} />
      ) : null}
      <Text
        variant="bodyBold"
        sx={{ color: 'text' }}
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
      {action !== undefined ? <EmptyStateActionButton action={action} /> : null}
    </StateBlock>
  );
}

function EmptyStateActionButton({ action }: { action: EmptyStateAction }) {
  return (
    <Button
      title={action.label}
      intent="primary"
      size="sm"
      onPress={action.onPress}
    />
  );
}
