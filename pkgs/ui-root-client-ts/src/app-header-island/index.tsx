/** @jsxImportSource solid-js */

import { useLingui } from '@lingui/solid/macro';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { For, type JSX, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import {
  useAppFrameBreadcrumbs,
  useAppFrameGlobalTrailing,
  useAppFrameScreenTitleId,
} from '../app-frame-chrome/index';
import type {
  AppHeaderIslandItem,
  AppHeaderIslandProps,
} from '../app-header-island-types';
import { ScreenBreadcrumbTrail } from '../screen-breadcrumb-trail/index';

const NAV_ICON_SIZE = 24;
const STROKE_CURRENT = 2.5;
const STROKE_DEFAULT = 2;

function HeaderNavItem(props: { item: AppHeaderIslandItem }): JSX.Element {
  return (
    <button
      class="clickable clickableTint flex-row items-center gap-2 px-4 h-11 rounded-full border transition-colors"
      classList={{
        'bg-tint-subtle border-outline': props.item.active,
        'border-transparent': !props.item.active,
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
        class="text textBody reserveBold"
        data-label={props.item.label}
        data-slot="label"
      >
        <span
          class="text line-clamp-1"
          classList={{
            'textBodyBold text-text': props.item.active,
            'textBody text-text-secondary': !props.item.active,
          }}
        >
          {props.item.label}
        </span>
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
      class="box shrink-0 flex-row items-center gap-1"
      aria-label={t`Navigation`}
    >
      <For each={props.items}>{(item) => <HeaderNavItem item={item} />}</For>
    </nav>
  );
}

/**
 * `AppHeaderIsland` -- wide-only top chrome: logo | navigation | actions, one
 * 52px row. Mounted via `AppFrame` `header`; compact layouts
 * use `TabBar` instead. The trailing slot falls back to the
 * `AppFrameChromeProvider` global chrome (avatar menu).
 *
 * With screen navigation enabled on the chrome provider, subscreens replace
 * primary pills with their existing breadcrumb ancestors and current-page pill.
 * Navigation items are buttons in a `navigation` landmark, not ARIA tabs (no
 * panels, no arrow-key roving). The current one is `aria-current="page"`,
 * drawn in full text color, semibold, inside a rounded neutral pill; the rest are secondary. Every label
 * box is held at its semibold width (`reserveBold`), so selecting an item
 * never shifts the row. The row stays on the wide column.
 *
 * @example
 * ```tsx
 * <AppFrame header={<AppHeaderIsland leading={<AppLogo />} items={tabs} />}>
 *   …
 * </AppFrame>
 * ```
 */
export function AppHeaderIsland(props: AppHeaderIslandProps): JSX.Element {
  const globalTrailing = useAppFrameGlobalTrailing();
  const breadcrumbs = useAppFrameBreadcrumbs();
  const titleId = useAppFrameScreenTitleId();
  const trailing = (): JSX.Element => props.trailing ?? globalTrailing();
  return (
    <header
      class="box shrink-0 bg-transparent"
      {...dataAttrs({ component: 'AppHeaderIsland', ...props.dataSet })}
    >
      <div class="box flex-row items-center gap-4 h-13 overflow-hidden">
        {/* Clips rather than spills: in a narrow window the brand yields to
            the navigation instead of sliding under it. */}
        <div class="box flex-1 min-w-0 overflow-hidden flex-row items-center justify-start">
          {props.leading}
        </div>
        <Show
          when={breadcrumbs().length > 1}
          fallback={
            <Show when={(props.items?.length ?? 0) > 0}>
              <HeaderNav items={props.items ?? []} />
            </Show>
          }
        >
          <ScreenBreadcrumbTrail
            breadcrumbs={breadcrumbs()}
            presentation="pills"
            currentTitleId={titleId()}
          />
        </Show>
        <div class="box flex-1 min-w-0 max-w-9/20 flex-row items-center justify-end gap-2">
          {trailing()}
        </div>
      </div>
    </header>
  );
}
