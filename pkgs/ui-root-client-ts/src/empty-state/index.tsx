/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import { Button } from '../button/index';
import type { IconComponent } from '../create-icon/index';
import type { StateBlockVariant } from '../state-block/index';
import {
  StateBlock,
  StateBlockActions,
  StateBlockIcon,
} from '../state-block/index';

export type EmptyStateAction = {
  label: JSX.Element;
  onClick: () => void;
};

export type EmptyStateProps = {
  /** Optional outline icon in a hairline disc above the title. */
  icon?: IconComponent | undefined;
  /** What is empty, in sentence case ("No friends yet"). */
  title: JSX.Element;
  /** One line that says what to do next. Required: an empty state invites. */
  body: JSX.Element;
  /** The primary action that fills the screen, when the screen can do it. */
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

/**
 * `EmptyState` -- canonical "no data" block, and an invitation.
 *
 * An empty screen tells a person what to do next: a short title (what is
 * empty), one line of body that says how to fill it, and, where the screen
 * can do it, the primary action. `body` is required so no empty state is
 * only a shrug; write it in the second person, sentence case, no emoji
 * ("Share the space link to invite people."). The action label says what
 * happens ("New space", not "OK").
 *
 * @example
 * ```tsx
 * <EmptyState
 *   icon={HouseIcon}
 *   title={<Trans>No live spaces</Trans>}
 *   body={<Trans>Start one and invite your friends.</Trans>}
 *   action={{ label: t`New space`, onClick: createSpace }}
 * />
 * <EmptyState
 *   variant="compact"
 *   title={t`No results`}
 *   body={t`Try a different search.`}
 * />
 * ```
 */
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
      <p
        class="text text-text-secondary text-center w-full"
        classList={{ textBody: isFill(), textCaption: !isFill() }}
      >
        {props.body}
      </p>
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
