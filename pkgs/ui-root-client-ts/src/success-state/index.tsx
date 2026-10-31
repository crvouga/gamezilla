/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { iconSize } from '@pkgs/ui-root-shared-ts/sizes';
import { type JSX, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { Button } from '../button/index';
import type { IconComponent } from '../create-icon/index';
import { CircleCheckIcon } from '../icons';
import type { StateBlockVariant } from '../state-block/index';
import {
  StateBlock,
  StateBlockActions,
  StateBlockIcon,
} from '../state-block/index';

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

function SuccessStateFill(props: SuccessStateProps): JSX.Element {
  return (
    <StateBlock
      variant="fill"
      role="status"
      dataSet={{ component: 'SuccessState', ...props.dataSet }}
    >
      <StateBlockIcon icon={props.icon ?? CircleCheckIcon} tone="success" />
      <p class="text textSubtitle text-center w-full">{props.title}</p>
      <Show when={props.body !== undefined && props.body !== null}>
        <p class="text textBody text-text-secondary text-center w-full">
          {props.body}
        </p>
      </Show>
      <Show when={props.action}>
        {(action) => (
          <StateBlockActions>
            <Button
              title={action().label}
              intent="primary"
              size="md"
              onClick={() => action().onClick()}
            />
          </StateBlockActions>
        )}
      </Show>
    </StateBlock>
  );
}

function SuccessStateCompact(props: SuccessStateProps): JSX.Element {
  return (
    <div
      class="box flex-row items-start gap-3 px-4 py-3 bg-success-surface rounded-control"
      {...dataAttrs({ component: 'SuccessState', ...props.dataSet })}
      role="status"
    >
      <div class="box h-6 shrink-0 justify-center">
        <Dynamic
          component={props.icon ?? CircleCheckIcon}
          size={iconSize.md}
          color="success"
        />
      </div>
      <div class="box flex-1 min-w-0 gap-1">
        <p class="text textBodyBold text-success">{props.title}</p>
        <Show when={props.body !== undefined && props.body !== null}>
          <p class="text textCaption text-success">{props.body}</p>
        </Show>
        <Show when={props.action}>
          {(action) => (
            <div class="box mt-1 items-start">
              <Button
                title={action().label}
                intent="primary"
                size="sm"
                onClick={() => action().onClick()}
              />
            </div>
          )}
        </Show>
      </div>
    </div>
  );
}

/**
 * `SuccessState` -- canonical post-action success block.
 *
 * The success counterpart to `ErrorState`: same layout contract, same
 * density variants: the check in a hairline disc when it fills a screen,
 * a `success-surface` wash when it sits inline. Use after a
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
