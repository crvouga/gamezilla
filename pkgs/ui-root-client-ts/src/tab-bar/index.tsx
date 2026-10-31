/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { For, type JSX, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { Badge } from '../badge/index';
import type { IconComponent } from '../create-icon/index';

export type TabBarItem = {
  /** Stable key for the destination. */
  readonly id: string;
  /** Visible caption and accessible name. */
  readonly label: string;
  /** 24px outline icon. */
  readonly icon: IconComponent;
  /** The destination on screen now (`aria-current="page"`). */
  readonly current: boolean;
  /** Makes the item a link to this URL. */
  readonly href?: string | undefined;
  /** Runs on click, tap and keyboard activation. */
  readonly onPress?: (() => void) | undefined;
  /** Short count or mark over the icon (`"3"`, `"99+"`). */
  readonly badge?: string | undefined;
  /** DOM `data-*` identifiers for the item (`testid`, …). */
  readonly dataSet?: ComponentDataSet | undefined;
};

export type TabBarProps = {
  readonly items: readonly TabBarItem[];
  /** Names the navigation landmark. */
  readonly 'aria-label': string;
  /** DOM `data-*` identifiers for the bar. */
  readonly dataSet?: ComponentDataSet | undefined;
};

const ICON_SIZE = 24;
const STROKE_CURRENT = 2.5;
const STROKE_DEFAULT = 2;

const ITEM_CLASS =
  'clickable clickableOpacity flex-1 min-w-0 h-13 items-center justify-center gap-1 px-1';

/** A click the browser should keep: new tab, new window, download. */
function isModifiedClick(event: MouseEvent): boolean {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

function TabBarItemFace(props: { item: TabBarItem }): JSX.Element {
  return (
    <>
      <span class="box relative items-center justify-center">
        <Dynamic
          component={props.item.icon}
          size={ICON_SIZE}
          strokeWidth={props.item.current ? STROKE_CURRENT : STROKE_DEFAULT}
          color={props.item.current ? 'text' : 'textSecondary'}
        />
        <Show when={props.item.badge}>
          {(badge) => (
            <span class="box absolute -top-1 -right-3" aria-hidden="true">
              <Badge
                label={badge()}
                intent="destructive"
                tone="solid"
                size="sm"
              />
            </span>
          )}
        </Show>
      </span>
      <span
        class="text textFootnote reserveBold"
        data-label={props.item.label}
        data-slot="label"
      >
        <span
          class="text textFootnote line-clamp-1 max-w-full transition-colors"
          classList={{
            'text-text font-semibold': props.item.current,
            'text-text-secondary': !props.item.current,
          }}
        >
          {props.item.label}
        </span>
      </span>
    </>
  );
}

function TabBarLink(props: { item: TabBarItem; href: string }): JSX.Element {
  const onClick = (event: MouseEvent): void => {
    const press = props.item.onPress;
    if (press === undefined || isModifiedClick(event)) return;
    event.preventDefault();
    press();
  };
  return (
    <a
      class={ITEM_CLASS}
      {...dataAttrs({ component: 'TabBarItem', ...props.item.dataSet })}
      href={props.href}
      aria-label={props.item.label}
      aria-current={props.item.current ? 'page' : undefined}
      onClick={onClick}
    >
      <TabBarItemFace item={props.item} />
    </a>
  );
}

function TabBarButton(props: { item: TabBarItem }): JSX.Element {
  return (
    <button
      class={ITEM_CLASS}
      {...dataAttrs({ component: 'TabBarItem', ...props.item.dataSet })}
      type="button"
      aria-label={props.item.label}
      aria-current={props.item.current ? 'page' : undefined}
      onClick={() => props.item.onPress?.()}
    >
      <TabBarItemFace item={props.item} />
    </button>
  );
}

/**
 * `TabBar` -- the compact bottom navigation: one destination per item, icon
 * over label, pinned under the content on phones.
 *
 * - **Look.** A 52px row on the canvas with one hairline above it and the
 *   bottom safe-area inset below. Icons are 24px outlines with a 12px label
 *   under them. The current item is drawn in full text color with a heavier
 *   stroke and a semibold label; the rest are secondary. No blue, no
 *   indicator pill: the convention of the big social apps. Each label box
 *   is held at its semibold width (`reserveBold`), so selection never
 *   reflows the labels.
 * - **Meaning.** A `navigation` landmark of links or buttons, never an ARIA
 *   `tablist`: that role needs `tab` children, panels and arrow-key roving,
 *   and a listener would hear an empty tab list (ACT bc4a75). The current
 *   item carries `aria-current="page"`, so color never carries it alone.
 * - **Activation.** `href` makes the item a real link (modified clicks still
 *   open a new tab); `onPress` alongside it takes over a plain click. An item
 *   with only `onPress` is a button.
 * - **Badge.** A short count or mark over the icon's top end. The accessible
 *   name stays the label.
 *
 * @example
 * ```tsx
 * <TabBar
 *   aria-label={t`Navigation`}
 *   items={[
 *     { id: 'home', label: t`Home`, icon: HouseIcon, current: true, href: '/' },
 *     { id: 'inbox', label: t`Inbox`, icon: InboxIcon, current: false, href: '/inbox', badge: '3' },
 *   ]}
 * />
 * ```
 */
export function TabBar(props: TabBarProps): JSX.Element {
  return (
    <nav
      class="box shrink-0 bg-background border-t border-border safeBottom"
      {...dataAttrs({ component: 'TabBar', ...props.dataSet })}
      aria-label={props['aria-label']}
    >
      <div class="box flex-row items-stretch h-13">
        <For each={props.items}>
          {(item) => (
            <Show
              when={item.href}
              fallback={<TabBarButton item={item} />}
              keyed
            >
              {(href) => <TabBarLink item={item} href={href} />}
            </Show>
          )}
        </For>
      </div>
    </nav>
  );
}
