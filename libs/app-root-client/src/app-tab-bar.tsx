/** @jsxImportSource solid-js */
/**
 * Compact bottom tab bar: one `Clickable` per tab (icon over label, ≥44px,
 * `aria-current="page"` on the active tab). A navigation of buttons, not an
 * ARIA `tablist`: that role needs `tab` children and arrow-key roving, and a
 * listener would hear an empty tab list (ACT bc4a75). Safe-area padding comes from the
 * `.safe-bottom` class in `styles/base.css` (never inline `env()`).
 */

import { isAppTabActive } from '@libs/app-root-shared/is-app-tab-active';
import { getTopBarContentHeight } from '@pkgs/ui-root-client/action-bar-chrome';
import { useThemeLayout } from '@pkgs/ui-root-client/theme-context';
import { For, type JSX } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type { AppTabSpec } from './app-tabs';
import { useAppTabs } from './app-tabs';

const TAB_ICON_SIZE = 24;
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
    <button
      class="clickable clickableTint flex-1 min-w-0 items-center justify-center gap-1"
      style={{
        height: `${Math.max(props.height, TAB_MIN_HEIGHT)}px`,
        'min-height': `${TAB_MIN_HEIGHT}px`,
        'padding-top': `${TAB_VERTICAL_PADDING}px`,
        'padding-bottom': `${TAB_VERTICAL_PADDING}px`,
      }}
      data-component="AppTabButton"
      data-testid={props.tab.testID}
      type="button"
      aria-label={props.tab.label}
      aria-current={props.active ? 'page' : undefined}
      onClick={() => props.onClick()}
    >
      <Dynamic
        component={props.tab.Icon}
        size={TAB_ICON_SIZE}
        color={color()}
      />
      <p
        class="text textCaption line-clamp-1"
        classList={{
          'text-tint': props.active,
          'text-tab-icon-default': !props.active,
        }}
      >
        {props.tab.label}
      </p>
    </button>
  );
}

export function AppTabBar(props: AppTabBarProps): JSX.Element {
  const layout = useThemeLayout();
  const tabs = useAppTabs();
  const height = () => getTopBarContentHeight(layout.breakpoint());
  return (
    <nav class="box bg-transparent safe-bottom" data-component="AppTabBar">
      <div
        class="box flex-row"
        style={{ height: `${height()}px`, 'min-height': `${height()}px` }}
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
      </div>
    </nav>
  );
}
