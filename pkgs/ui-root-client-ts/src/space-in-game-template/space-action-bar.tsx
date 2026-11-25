/** @jsxImportSource @solidjs/web */

import { useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import { createSignal, For, Show } from 'solid-js';
import { Button } from '../button/index';
import { spaceDataSet } from '../space-data-set';
import { SpaceMenuSheet } from '../space-menu-sheet/index';
import type { SpaceGameAction } from '../space-types';
import styles from './space-in-game-template.module.css';

/** The most controls the bar shows at once, More included. */
export const SPACE_ACTION_BAR_MAX = 3;

/**
 * The bar's split: every action when they fit; else the first ones and the
 * rest behind More, so no more than {@link SPACE_ACTION_BAR_MAX} show.
 */
export function spaceActionBarSplit(actions: readonly SpaceGameAction[]): {
  shown: readonly SpaceGameAction[];
  more: readonly SpaceGameAction[];
} {
  if (actions.length <= SPACE_ACTION_BAR_MAX)
    return { shown: actions, more: [] };
  const keep = SPACE_ACTION_BAR_MAX - 1;
  return { shown: actions.slice(0, keep), more: actions.slice(keep) };
}

function ActionButton(props: { action: SpaceGameAction }): JSX.Element {
  const primary = () => props.action.emphasis === 'primary';
  const destructive = () => props.action.tone === 'destructive';
  return (
    <Button
      title={props.action.label}
      intent={primary() ? 'primary' : destructive() ? 'danger' : 'neutral'}
      variant={primary() ? 'solid' : 'outline'}
      size="lg"
      fullWidth
      disabled={props.action.disabled}
      onClick={() => props.action.onPress()}
      dataSet={spaceDataSet({ action: props.action.id }, props.action.testId)}
    />
  );
}

function MoreButton(props: {
  actions: readonly SpaceGameAction[];
  testId: string | undefined;
}): JSX.Element {
  const { t } = useLingui();
  const [open, setOpen] = createSignal(false);
  return (
    <>
      <Button
        title={t`More`}
        intent="neutral"
        variant="outline"
        size="lg"
        fullWidth
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        dataSet={spaceDataSet({ action: 'more' }, props.testId)}
      />
      <SpaceMenuSheet
        open={open()}
        title={t`More actions`}
        items={props.actions.map((action) => ({
          id: action.id,
          label: action.label,
          tone: action.tone,
          disabled: action.disabled,
          onPress: action.onPress,
          testId: action.testId,
        }))}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

export type SpaceActionBarProps = {
  actions: readonly SpaceGameAction[];
  waiting?: string | undefined;
  /** More's `data-testid`, when the actions overflow. */
  moreTestId?: string | undefined;
};

/**
 * `SpaceActionBar` -- the bottom of an in-game stage, by the thumbs: one to
 * three controls for this exact moment (at most one primary, destructive
 * ones in the destructive tone), or one line saying what the viewer is
 * waiting for. Past three actions the third control is More, which opens
 * the rest in a centered modal. Always present at one height, so the board never
 * resizes.
 */
export function SpaceActionBar(props: SpaceActionBarProps): JSX.Element {
  const { t } = useLingui();
  const split = () => spaceActionBarSplit(props.actions);
  return (
    <div
      class={styles['bar']}
      role="group"
      aria-label={t`Game actions`}
      {...dataAttrs({ component: 'SpaceActionBar' })}
    >
      <Show
        when={split().shown.length > 0}
        fallback={
          <p class={`text textCaption ${styles['waiting']}`} role="status">
            {props.waiting ?? t`Waiting for the game`}
          </p>
        }
      >
        <For each={split().shown}>
          {(action) => <ActionButton action={action} />}
        </For>
        <Show when={split().more.length > 0}>
          <MoreButton actions={split().more} testId={props.moreTestId} />
        </Show>
      </Show>
    </div>
  );
}
