/** @jsxImportSource solid-js */
/**
 * `AppHeaderIsland` -- wide-only top chrome: logo | navigation | actions, one
 * 52px row over a hairline. Mounted via `AppFrame` `header`; compact layouts
 * use `TabBar` instead. The trailing slot falls back to the
 * `AppFrameChromeProvider` global chrome (avatar menu).
 *
 * Navigation items are buttons in a `navigation` landmark, not ARIA tabs (no
 * panels, no arrow-key roving). The current one is `aria-current="page"`,
 * drawn in full text color, semibold, with a 2px underline that sits on the
 * header's hairline; the rest are secondary. No colored pills.
 *
 * @example
 * ```tsx
 * <AppFrame header={<AppHeaderIsland leading={<AppLogo />} items={tabs} />}>
 *   …
 * </AppFrame>
 * ```
 */

import { useLingui } from '@lingui/solid/macro';
import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import { For, type JSX, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { useAppFrameGlobalTrailing } from './app-frame-chrome';
import type {
  AppHeaderIslandItem,
  AppHeaderIslandProps,
} from './app-header-island-types';

const NAV_ICON_SIZE = 24;
const STROKE_CURRENT = 2.5;
const STROKE_DEFAULT = 2;

function HeaderNavItem(props: { item: AppHeaderIslandItem }): JSX.Element {
  return (
    <button
      class="clickable clickableTint flex-row items-center gap-2 px-3 h-13 border-y-2 border-t-transparent transition-colors"
      classList={{
        'border-b-text': props.item.active,
        'border-b-transparent': !props.item.active,
      }}
      {...dataAttrs({ component: 'AppHeaderIslandTab', ...props.item.dataSet })}
      type="button"
      aria-label={props.item.label}
      aria-current={props.item.active ? 'page' : undefined}
      onClick={() => props.item.onClick()}
    >
      <Dynamic
        component={props.item.icon}
        size={NAV_ICON_SIZE}
        strokeWidth={props.item.active ? STROKE_CURRENT : STROKE_DEFAULT}
        color={props.item.active ? 'text' : 'textSecondary'}
      />
      <span
        class="text line-clamp-1"
        classList={{
          'textBodyBold text-text': props.item.active,
          'textBody text-text-secondary': !props.item.active,
        }}
      >
        {props.item.label}
      </span>
    </button>
  );
}

function HeaderNav(props: {
  items: readonly AppHeaderIslandItem[];
}): JSX.Element {
  const { t } = useLingui();
  return (
    <nav
      class="box shrink-0 flex-row items-stretch gap-1"
      aria-label={t`Navigation`}
    >
      <For each={props.items}>{(item) => <HeaderNavItem item={item} />}</For>
    </nav>
  );
}

export function AppHeaderIsland(props: AppHeaderIslandProps): JSX.Element {
  const globalTrailing = useAppFrameGlobalTrailing();
  const trailing = (): JSX.Element => props.trailing ?? globalTrailing();
  return (
    <header
      class="box shrink-0 bg-transparent border-b border-border overflow-hidden"
      {...dataAttrs({ component: 'AppHeaderIsland', ...props.dataSet })}
    >
      <div class="box flex-row items-center gap-4 h-13">
        {/* Clips rather than spills: in a narrow window the brand yields to
            the navigation instead of sliding under it. */}
        <div class="box flex-1 min-w-0 overflow-hidden flex-row items-center justify-start">
          {props.leading}
        </div>
        <Show when={(props.items?.length ?? 0) > 0}>
          <HeaderNav items={props.items ?? []} />
        </Show>
        <div class="box flex-1 min-w-0 max-w-9/20 flex-row items-center justify-end gap-2">
          {trailing()}
        </div>
      </div>
    </header>
  );
}
