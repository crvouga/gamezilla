/** @jsxImportSource solid-js */

import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { For, type JSX, Match, Switch } from 'solid-js';
import {
  BottomActionBarAction,
  BottomActionBarButton,
} from '../bottom-action-bar-parts/index';
import type {
  BottomActionBarItem,
  BottomActionBarProps,
} from '../bottom-action-bar-types';

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

/**
 * `BottomActionBar` -- chess.com-style play chrome for game screens.
 *
 * Equal-flex row that mixes labeled icon-tab actions with solid contained
 * buttons. Distinct from top `ActionBar` (icon overflow chrome). Transparent
 * chrome — no surface fill or hairline (page background shows through).
 */
export function BottomActionBar(props: BottomActionBarProps): JSX.Element {
  return (
    <div
      class="box flex-row items-center self-stretch gap-2 px-3"
      {...dataAttrs({ component: 'BottomActionBar', ...props.dataSet })}
      style={{ 'min-height': `${BOTTOM_ACTION_BAR_MIN_HEIGHT}px` }}
    >
      <For each={props.items}>
        {(item) => <BottomActionBarSlot item={item} />}
      </For>
    </div>
  );
}
