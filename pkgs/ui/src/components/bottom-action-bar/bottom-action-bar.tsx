/** @jsxImportSource solid-js */
/**
 * `BottomActionBar` -- chess.com-style play chrome for game screens.
 *
 * Equal-flex row that mixes labeled icon-tab actions with solid contained
 * buttons. Distinct from top `ActionBar` (icon overflow chrome).
 */

import { For, type JSX, Match, Switch } from 'solid-js';
import { dataAttrs } from '../../component-id';
import { joinClass } from '../box/box';
import {
  BottomActionBarAction,
  BottomActionBarButton,
} from './bottom-action-bar-parts';
import type {
  BottomActionBarItem,
  BottomActionBarProps,
} from './bottom-action-bar-types';

export const BOTTOM_ACTION_BAR_MIN_HEIGHT = 56;

function BottomActionBarSlot(props: {
  item: BottomActionBarItem;
}): JSX.Element {
  return (
    <Switch>
      <Match when={props.item.type === 'action' ? props.item : undefined}>
        {(item) => <BottomActionBarAction item={item()} />}
      </Match>
      <Match when={props.item.type === 'button' ? props.item : undefined}>
        {(item) => <BottomActionBarButton item={item()} />}
      </Match>
    </Switch>
  );
}

export function BottomActionBar(props: BottomActionBarProps): JSX.Element {
  const elevated = (): boolean => props.elevated !== false;
  return (
    <div
      class={joinClass(
        'box flex-row items-center self-stretch gap-2 px-3',
        elevated() && 'bg-surface border-t border-solid border-border'
      )}
      {...dataAttrs({ component: 'BottomActionBar', ...props.dataSet })}
      style={{ 'min-height': `${BOTTOM_ACTION_BAR_MIN_HEIGHT}px` }}
    >
      <For each={props.items}>
        {(item) => <BottomActionBarSlot item={item} />}
      </For>
    </div>
  );
}
