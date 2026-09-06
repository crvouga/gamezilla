/** @jsxImportSource solid-js */
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
 *   action={{ label: t`+ New space`, onClick: createSpace }}
 * />
 * <EmptyState variant="compact" title={t`No results match filter.`} />
 * ```
 */

import { type JSX, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type { ComponentDataSet } from '../../component-id';
import { Box } from '../box';
import { Button } from '../button';
import type { IconComponent } from '../icons';
import { StateBlock, type StateBlockVariant } from '../state-block';
import { Text } from '../text';

export type EmptyStateAction = {
  label: JSX.Element;
  onClick: () => void;
};

export type EmptyStateProps = {
  /** Optional icon rendered above the title. Tinted with `textSecondary`. */
  icon?: IconComponent | undefined;
  title: JSX.Element;
  body?: JSX.Element | undefined;
  /** Optional primary action below the body. */
  action?: EmptyStateAction | undefined;
  /** Layout density. Defaults to `'fill'`. */
  variant?: StateBlockVariant | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

const FILL_ICON_SIZE = 28;
const FILL_ICON_DISC = 64;
const COMPACT_ICON_SIZE = 24;
/** Keeps body copy to a readable measure on wide layouts. */
const BODY_MAX_WIDTH = 360;

function EmptyStateIcon(props: {
  icon: IconComponent;
  variant: StateBlockVariant;
}): JSX.Element {
  return (
    <Show
      when={props.variant === 'fill'}
      fallback={
        <Dynamic
          component={props.icon}
          size={COMPACT_ICON_SIZE}
          color="textSecondary"
        />
      }
    >
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
        <Dynamic
          component={props.icon}
          size={FILL_ICON_SIZE}
          color="textSecondary"
        />
      </Box>
    </Show>
  );
}

export function EmptyState(props: EmptyStateProps): JSX.Element {
  const variant = (): StateBlockVariant => props.variant ?? 'fill';
  const isFill = (): boolean => variant() === 'fill';
  return (
    <StateBlock
      variant={variant()}
      dataSet={{ component: 'EmptyState', ...props.dataSet }}
    >
      <Show when={props.icon}>
        {(icon) => <EmptyStateIcon icon={icon()} variant={variant()} />}
      </Show>
      <Text
        variant={isFill() ? 'subtitle' : 'bodyBold'}
        sx={{ color: 'text', textAlign: 'center' }}
        label={props.title}
      />
      <Show when={props.body !== undefined && props.body !== null}>
        <Text
          variant={isFill() ? 'body' : 'caption'}
          sx={{
            color: 'textSecondary',
            textAlign: 'center',
            maxWidth: BODY_MAX_WIDTH,
          }}
          label={props.body}
        />
      </Show>
      <Show when={props.action}>
        {(action) => (
          <Box sx={{ mt: 2 }}>
            <Button
              title={action().label}
              intent="primary"
              size={isFill() ? 'md' : 'sm'}
              onClick={() => action().onClick()}
            />
          </Box>
        )}
      </Show>
    </StateBlock>
  );
}
