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
import type { ComponentDataSet } from '@pkgs/ui-shared/component-id';
import { dataAttrs } from '@pkgs/ui-shared/component-id';
import { Button } from './button';
import { CircleCheckIcon } from './icons';
import type { IconComponent } from './create-icon';
import { StateBlock } from './state-block';
import type { StateBlockVariant } from './state-block';

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
        <div
          class="box"
          classList={{ 'mt-1': props.compact, 'items-start': props.compact }}
        >
          <Button
            title={action().label}
            intent="primary"
            size="sm"
            onClick={() => action().onClick()}
          />
        </div>
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
      <p class="text textBodyBold text-success text-center">{props.title}</p>
      <Show when={props.body !== undefined && props.body !== null}>
        <p class="text textCaption text-text-secondary text-center">
          {props.body}
        </p>
      </Show>
      <SuccessAction action={props.action} compact={false} />
    </StateBlock>
  );
}

function SuccessStateCompact(props: SuccessStateProps): JSX.Element {
  return (
    <div
      class="box flex-row items-start gap-3 p-3 border border-success bg-success-surface rounded-control"
      {...dataAttrs({ component: 'SuccessState', ...props.dataSet })}
      role="status"
    >
      <div class="box pt-0.5">
        <Dynamic
          component={props.icon ?? CircleCheckIcon}
          size={ICON_SIZE_COMPACT}
          color="success"
        />
      </div>
      <div class="box flex-1 gap-1">
        <p class="text textBodyBold text-success">{props.title}</p>
        <Show when={props.body !== undefined && props.body !== null}>
          <p class="text textCaption text-success">{props.body}</p>
        </Show>
        <SuccessAction action={props.action} compact />
      </div>
    </div>
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
