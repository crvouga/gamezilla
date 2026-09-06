/** @jsxImportSource solid-js */
/**
 * Compact bottom tab bar: one `Clickable` per tab (icon over label, ≥44px,
 * `aria-current="page"` on the active tab). Safe-area padding comes from the
 * `.safe-bottom` class in `styles/base.css` (never inline `env()`).
 */

import {
  Box,
  Clickable,
  getTopBarContentHeight,
  Text,
  useThemeLayout,
} from '@pkgs/ui';
import { For, type JSX } from 'solid-js';
import { Dynamic } from 'solid-js/web';

import { type AppTabSpec, useAppTabs } from '../routes/app-tabs';
import { isAppTabActive } from '../routes/is-app-tab-active';

const TAB_ICON_SIZE = 24;
const TAB_LABEL_FONT_SIZE = 13;
const TAB_VERTICAL_PADDING = 5;
const TAB_MIN_HEIGHT = 44;

export type AppTabBarProps = {
  readonly pathname: string;
  readonly onSelect: (tab: AppTabSpec) => void;
};

function AppTabButton(props: {
  readonly tab: AppTabSpec;
  readonly active: boolean;
  readonly height: number;
  readonly onClick: () => void;
}): JSX.Element {
  const color = (): 'tint' | 'tabIconDefault' =>
    props.active ? 'tint' : 'tabIconDefault';
  return (
    <Clickable
      aria-label={props.tab.label}
      aria-current={props.active ? 'page' : undefined}
      onClick={() => props.onClick()}
      dataSet={{ component: 'AppTabButton', testid: props.tab.testID }}
      sx={{
        flex: 1,
        minWidth: 0,
        height: Math.max(props.height, TAB_MIN_HEIGHT),
        minHeight: TAB_MIN_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: TAB_VERTICAL_PADDING,
        gap: 1,
      }}
    >
      <Dynamic
        component={props.tab.Icon}
        size={TAB_ICON_SIZE}
        color={color()}
      />
      <Text
        variant="caption"
        numberOfLines={1}
        sx={{ fontSize: TAB_LABEL_FONT_SIZE, color: color() }}
        label={props.tab.label}
      />
    </Clickable>
  );
}

export function AppTabBar(props: AppTabBarProps): JSX.Element {
  const layout = useThemeLayout();
  const tabs = useAppTabs();
  const height = () => getTopBarContentHeight(layout.breakpoint());
  return (
    <Box
      as="nav"
      class="safe-bottom"
      dataSet={{ component: 'AppTabBar' }}
      sx={{ background: 'surface', borderTopWidth: 1, borderColor: 'border' }}
    >
      <Box
        role="tablist"
        sx={{ flexDirection: 'row', height: height(), minHeight: height() }}
      >
        <For each={tabs()}>
          {(tab) => (
            <AppTabButton
              tab={tab}
              active={isAppTabActive(tab.href, props.pathname)}
              height={height()}
              onClick={() => props.onSelect(tab)}
            />
          )}
        </For>
      </Box>
    </Box>
  );
}
