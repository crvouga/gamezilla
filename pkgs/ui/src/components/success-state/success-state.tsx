/** @jsxImportSource solid-js */
/**
 * `SuccessState` -- canonical post-action success block.
 *
 * The success counterpart to `ErrorState`: same layout contract, same
 * density variants, paired with the `success` color ramp. Use after a
 * confirm flow completes ("Saved", "Server config updated"), or as a
 * standalone full-screen confirmation between steps.
 *
 * @example
 * ```tsx
 * <SuccessState
 *   title={t`Server config updated`}
 *   body={t`Clients sync on the next sync tick.`}
 * />
 * <SuccessState variant="compact" title={t`Saved`} />
 * ```
 */

import { type JSX, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type { ComponentDataSet } from '../../component-id';
import { Box } from '../box';
import { Button } from '../button';
import { CircleCheckIcon, type IconComponent } from '../icons';
import { StateBlock, type StateBlockVariant } from '../state-block';
import { Text } from '../text';

export type SuccessStateAction = {
  label: JSX.Element;
  onClick: () => void;
};

export type SuccessStateProps = {
  /** Defaults to the design-system check-in-circle icon. */
  icon?: IconComponent | undefined;
  title: JSX.Element;
  body?: JSX.Element | undefined;
  /** Optional CTA below the body. */
  action?: SuccessStateAction | undefined;
  /** Layout density. Defaults to `'fill'`. */
  variant?: StateBlockVariant | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

const ICON_SIZE_FILL = 32;
const ICON_SIZE_COMPACT = 20;

function SuccessAction(props: {
  action: SuccessStateAction | undefined;
  compact: boolean;
}): JSX.Element {
  return (
    <Show when={props.action}>
      {(action) => (
        <Box sx={props.compact ? { mt: 1, alignItems: 'flex-start' } : {}}>
          <Button
            title={action().label}
            intent="primary"
            size="sm"
            onClick={() => action().onClick()}
          />
        </Box>
      )}
    </Show>
  );
}

function SuccessStateFill(props: SuccessStateProps): JSX.Element {
  return (
    <StateBlock
      variant="fill"
      role="status"
      dataSet={{ component: 'SuccessState', ...props.dataSet }}
    >
      <Dynamic
        component={props.icon ?? CircleCheckIcon}
        size={ICON_SIZE_FILL}
        color="success"
      />
      <Text
        variant="bodyBold"
        sx={{ color: 'success', textAlign: 'center' }}
        label={props.title}
      />
      <Show when={props.body !== undefined && props.body !== null}>
        <Text
          variant="caption"
          sx={{ color: 'textSecondary', textAlign: 'center' }}
          label={props.body}
        />
      </Show>
      <SuccessAction action={props.action} compact={false} />
    </StateBlock>
  );
}

function SuccessStateCompact(props: SuccessStateProps): JSX.Element {
  return (
    <Box
      role="status"
      dataSet={{ component: 'SuccessState', ...props.dataSet }}
      sx={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 3,
        p: 3,
        borderWidth: 1,
        borderColor: 'success',
        backgroundColor: 'successSurface',
        borderRadius: 'md',
      }}
    >
      <Box sx={{ pt: 0.5 }}>
        <Dynamic
          component={props.icon ?? CircleCheckIcon}
          size={ICON_SIZE_COMPACT}
          color="success"
        />
      </Box>
      <Box sx={{ flex: 1, gap: 1 }}>
        <Text
          variant="bodyBold"
          sx={{ color: 'success' }}
          label={props.title}
        />
        <Show when={props.body !== undefined && props.body !== null}>
          <Text
            variant="caption"
            sx={{ color: 'success' }}
            label={props.body}
          />
        </Show>
        <SuccessAction action={props.action} compact />
      </Box>
    </Box>
  );
}

export function SuccessState(props: SuccessStateProps): JSX.Element {
  return (
    <Show
      when={(props.variant ?? 'fill') === 'compact'}
      fallback={<SuccessStateFill {...props} />}
    >
      <SuccessStateCompact {...props} />
    </Show>
  );
}
