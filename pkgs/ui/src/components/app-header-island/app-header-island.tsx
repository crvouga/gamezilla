/** @jsxImportSource solid-js */
import { cssPx } from '../../css/css-px';
/**
 * `AppHeaderIsland` -- wide-only top chrome: logo | pill tabs | trailing.
 * Mounted via `AppFrame` `header`; not used on compact layouts. Flat hairline
 * bar (no elevated card). The trailing slot falls back to the
 * `AppFrameChromeProvider` global chrome (avatar menu).
 *
 * @example
 * ```tsx
 * <AppFrame header={<AppHeaderIsland leading={<AppLogo />} items={tabs} />}>
 *   …
 * </AppFrame>
 * ```
 */

import { For, type JSX, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { dataAttrs } from '../../component-id';
import { getTopBarContentHeight, useThemeLayout } from '../../theme';
import { useAppFrameGlobalTrailing } from '../app-frame';
import type {
  AppHeaderIslandItem,
  AppHeaderIslandProps,
} from './app-header-island-types';

/** Pills keep a legal pointer target even though the caption is compact. */
const PILL_MIN_HEIGHT = 44;
const PILL_ICON_SIZE = 18;

function HeaderPill(props: { item: AppHeaderIslandItem }): JSX.Element {
  const color = (): 'text' | 'textSecondary' =>
    props.item.active ? 'text' : 'textSecondary';
  return (
    <button
      class="clickable clickableTint flex-row items-center gap-1.5 px-3 rounded-[9999px]"
      classList={{
        'bg-surface': props.item.active,
        'bg-transparent': !props.item.active,
      }}
      {...dataAttrs({ component: 'AppHeaderIslandTab', ...props.item.dataSet })}
      type="button"
      style={{ 'min-height': cssPx(PILL_MIN_HEIGHT) }}
      role="tab"
      aria-selected={props.item.active}
      aria-label={props.item.label}
      onClick={() => props.item.onClick()}
    >
      <Dynamic
        component={props.item.icon}
        size={PILL_ICON_SIZE}
        color={color()}
      />
      <label
        class="text textLabel"
        classList={{
          'text-text': props.item.active,
          'text-text-secondary': !props.item.active,
          'font-semibold': props.item.active,
          'font-medium': !props.item.active,
        }}
      >
        {props.item.label}
      </label>
    </button>
  );
}

function HeaderPillGroup(props: {
  items: readonly AppHeaderIslandItem[];
}): JSX.Element {
  return (
    <div class="box flex-row items-center gap-1" role="tablist">
      <For each={props.items}>{(item) => <HeaderPill item={item} />}</For>
    </div>
  );
}

export function AppHeaderIsland(props: AppHeaderIslandProps): JSX.Element {
  const layout = useThemeLayout();
  const globalTrailing = useAppFrameGlobalTrailing();
  const contentHeight = (): number =>
    getTopBarContentHeight(layout.breakpoint());
  const trailing = (): JSX.Element => props.trailing ?? globalTrailing();
  return (
    <header
      class="box bg-transparent overflow-hidden"
      {...dataAttrs({ component: 'AppHeaderIsland', ...props.dataSet })}
    >
      <div
        class="box flex-row items-center gap-2 px-1"
        style={{
          height: cssPx(contentHeight()),
          'min-height': cssPx(contentHeight()),
        }}
      >
        <div class="box flex-1 min-w-[0] flex-row items-center justify-start">
          {props.leading}
        </div>
        <Show when={(props.items?.length ?? 0) > 0}>
          <div class="box shrink-0">
            <HeaderPillGroup items={props.items ?? []} />
          </div>
        </Show>
        <div class="box flex-1 min-w-[0] max-w-[45%] flex-row items-center justify-end">
          {trailing()}
        </div>
      </div>
    </header>
  );
}
