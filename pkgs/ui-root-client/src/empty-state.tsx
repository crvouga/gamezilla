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

import type { ComponentDataSet } from '@pkgs/ui-root-shared/component-id';
import { type JSX, Show } from 'solid-js';
import { Button } from './button';
import type { IconComponent } from './create-icon';
import type { StateBlockVariant } from './state-block';
import { StateBlock, StateBlockActions, StateBlockIcon } from './state-block';

export type EmptyStateAction = {
  label: JSX.Element;
  onClick: () => void;
};

export type EmptyStateProps = {
  /** Optional outline icon in a hairline disc above the title. */
  icon?: IconComponent | undefined;
  title: JSX.Element;
  body?: JSX.Element | undefined;
  /** Optional primary action below the body. */
  action?: EmptyStateAction | undefined;
  /** Layout density. Defaults to `'fill'`. */
  variant?: StateBlockVariant | undefined;
  /** Live-region role when the empty block replaces a loading status. */
  role?: 'status' | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

/** `<root testid>-action` so spec can tap the primary action (undefined otherwise). */
export function emptyStateActionDataSet(
  dataSet: ComponentDataSet | undefined
): ComponentDataSet | undefined {
  const testid = dataSet?.['testid'];
  return typeof testid === 'string'
    ? { testid: `${testid}-action` }
    : undefined;
}

export function EmptyState(props: EmptyStateProps): JSX.Element {
  const variant = (): StateBlockVariant => props.variant ?? 'fill';
  const isFill = (): boolean => variant() === 'fill';
  return (
    <StateBlock
      variant={variant()}
      role={props.role}
      dataSet={{ component: 'EmptyState', ...props.dataSet }}
    >
      <Show when={props.icon}>
        {(icon) => <StateBlockIcon icon={icon()} variant={variant()} />}
      </Show>
      <p
        class="text text-center w-full"
        classList={{ textSubtitle: isFill(), textLabel: !isFill() }}
      >
        {props.title}
      </p>
      <Show when={props.body !== undefined && props.body !== null}>
        <p
          class="text text-text-secondary text-center w-full"
          classList={{ textBody: isFill(), textCaption: !isFill() }}
        >
          {props.body}
        </p>
      </Show>
      <Show when={props.action}>
        {(action) => (
          <StateBlockActions>
            <Button
              title={action().label}
              intent="primary"
              size={isFill() ? 'md' : 'sm'}
              onClick={() => action().onClick()}
              dataSet={emptyStateActionDataSet(props.dataSet)}
            />
          </StateBlockActions>
        )}
      </Show>
    </StateBlock>
  );
}
