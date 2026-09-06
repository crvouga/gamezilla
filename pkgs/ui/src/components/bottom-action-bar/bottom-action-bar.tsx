/** @jsxImportSource solid-js */
/**
 * `BottomActionBar` -- chess.com-style play chrome for game screens.
 *
 * Equal-flex row that mixes labeled icon-tab actions with solid contained
 * buttons. Distinct from top `ActionBar` (icon overflow chrome).
 *
 * @example
 * ```tsx
 * <BottomActionBar
 *   items={[
 *     { type: 'action', id: 'hint', label: 'Hint', icon: LightbulbIcon, onClick },
 *     { type: 'button', id: 'next', title: 'Next', onClick },
 *   ]}
 * />
 * ```
 */

import { For, type JSX, Match, Switch } from 'solid-js';
import { Box } from '../box';
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
    <Box
      dataSet={{ component: 'BottomActionBar', ...props.dataSet }}
      sx={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'stretch',
          gap: 2,
          px: 3,
          minHeight: BOTTOM_ACTION_BAR_MIN_HEIGHT,
        },
        elevated() && {
          backgroundColor: 'surface',
          borderColor: 'border',
          borderTopWidth: 1,
        },
      ]}
    >
      <For each={props.items}>
        {(item) => <BottomActionBarSlot item={item} />}
      </For>
    </Box>
  );
}
