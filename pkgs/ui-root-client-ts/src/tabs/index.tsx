/** @jsxImportSource solid-js */

import { componentId } from '@pkgs/ui-root-shared-ts/component-id';
import {
  firstEnabledIndex,
  nextRovingIndex,
} from '@pkgs/ui-root-shared-ts/roving-focus';
import { createSignal, createUniqueId, For, type JSX, Show } from 'solid-js';
import { spaced } from '../layout-classes';
import { useLayoutMode } from '../use-layout-mode';

export type TabItem<V extends string = string> = {
  readonly value: V;
  readonly label: string;
  /** A count or short note after the label (`12`, `New`). */
  readonly badge?: string | number | undefined;
  readonly disabled?: boolean | undefined;
};

export type TabsVariant = 'underline' | 'pill';

export type TabsProps<V extends string = string> = {
  items: readonly TabItem<V>[];
  /** The selected tab, when the caller owns it. */
  value?: V | undefined;
  /** First selected tab when uncontrolled. Default: the first enabled. */
  defaultValue?: V | undefined;
  onValueChange?: ((value: V) => void) | undefined;
  /** Default `underline`. */
  variant?: TabsVariant | undefined;
  /** The selected tab's panel. */
  children?: ((value: V) => JSX.Element) | undefined;
  'aria-label'?: string | undefined;
  'aria-labelledby'?: string | undefined;
  /** Rendered as `data-testid`; each tab gets `<testId>-<value>`. */
  testId?: string | undefined;
};

type TabLook = { readonly list: string; readonly tab: string };

const LOOK: Readonly<Record<TabsVariant, TabLook>> = {
  underline: {
    list: 'box flex-row border-b border-border',
    tab: 'min-h-ui-control-lg px-ui-lg',
  },
  pill: {
    list: 'box flex-row self-start gap-ui-xs p-ui-xs rounded-full bg-surface-muted',
    tab: 'min-h-ui-control-sm px-ui-lg rounded-full border',
  },
};

function tabClass(
  variant: TabsVariant,
  selected: boolean,
  equal: boolean
): string {
  return spaced([
    'clickable flex-row items-center justify-center gap-ui-xs transition-colors',
    LOOK[variant].tab,
    equal ? 'flex-1' : undefined,
    selected ? 'text-text' : 'text-text-secondary clickableTint',
    variant === 'pill' && selected
      ? 'bg-surface-elevated border-border'
      : undefined,
    variant === 'pill' && !selected ? 'border-transparent' : undefined,
  ]);
}

function UnderlineRule(props: { selected: boolean }): JSX.Element {
  return (
    <span
      class={spaced([
        'absolute inset-x-0 -bottom-px border-b-2 transition-colors',
        props.selected ? 'border-text' : 'border-transparent',
      ])}
      aria-hidden="true"
    />
  );
}

/** The first enabled tab's value: the selection before anyone picks. */
function firstTabValue<V extends string>(
  items: readonly TabItem<V>[]
): V | undefined {
  const index = firstEnabledIndex(items.map((item) => item.disabled === true));
  return index === null ? undefined : items[index]?.value;
}

function onTabKeyDown(tab: HTMLElement, event: KeyboardEvent): void {
  const list = tab.closest('[role="tablist"]');
  if (list === null) return;
  const tabs = Array.from(
    list.querySelectorAll<HTMLButtonElement>('[role="tab"]')
  );
  const next = nextRovingIndex({
    key: event.key,
    current: tabs.findIndex((tab) => tab === document.activeElement),
    disabled: tabs.map((tab) => tab.disabled),
    orientation: 'horizontal',
  });
  if (next === null) return;
  event.preventDefault();
  const target = tabs[next];
  target?.focus();
  target?.click();
}

/**
 * `Tabs` -- sibling views of one place, one shown at a time (the WAI-ARIA
 * tabs pattern with automatic activation).
 *
 * - The tab list is one tab stop, the selected tab. ArrowLeft / ArrowRight
 *   move to the previous / next enabled tab (wrapping) and show it; Home and
 *   End jump to the first and last. Tab moves on into the panel.
 * - `value` + `onValueChange` control it; without `value` it keeps its own
 *   state from `defaultValue` (default: the first enabled tab).
 * - The panel is the `children` render prop, called with the selected value.
 *   Every tab has a panel element so `aria-controls` always resolves; only the
 *   selected one renders content.
 *
 * Variants:
 * - `underline` (default): the profile-tab look. A hairline track under the
 *   row and a 2px text-colored rule under the selected tab, whose label goes
 *   from secondary to full text color. On compact layouts the tabs share the
 *   width equally.
 * - `pill`: a segmented track; the selected tab is a raised pill.
 *
 * @example
 * ```tsx
 * <Tabs
 *   aria-label={t`Profile`}
 *   items={[
 *     { value: 'games', label: t`Games`, badge: 12 },
 *     { value: 'friends', label: t`Friends` },
 *   ]}
 * >
 *   {(value) => <Switch><Match when={value === 'games'}>…</Match>…</Switch>}
 * </Tabs>
 * ```
 */
export function Tabs<V extends string = string>(
  props: TabsProps<V>
): JSX.Element {
  const base = `tabs-${createUniqueId()}`;
  const mode = useLayoutMode();
  const [own, setOwn] = createSignal<V | undefined>();
  const selected = (): V | undefined =>
    props.value ?? own() ?? props.defaultValue ?? firstTabValue(props.items);
  const select = (value: V): void => {
    if (value === selected()) return;
    setOwn(() => value);
    props.onValueChange?.(value);
  };
  const variant = (): TabsVariant => props.variant ?? 'underline';
  const equal = (): boolean =>
    variant() === 'underline' && mode() === 'compact';
  const tabId = (index: number): string => `${base}-tab-${index}`;
  const panelId = (index: number): string => `${base}-panel-${index}`;
  return (
    <div
      class="box"
      data-testid={props.testId}
      data-component={componentId('Tabs')}
      data-variant={variant()}
    >
      <div
        class={LOOK[variant()].list}
        role="tablist"
        aria-orientation="horizontal"
        aria-label={props['aria-label']}
        aria-labelledby={props['aria-labelledby']}
      >
        <For each={props.items}>
          {(item, index) => {
            const isSelected = (): boolean => item.value === selected();
            return (
              <button
                type="button"
                class={tabClass(variant(), isSelected(), equal())}
                id={tabId(index())}
                data-testid={
                  props.testId === undefined
                    ? undefined
                    : `${props.testId}-${item.value}`
                }
                data-component={componentId('Tab')}
                role="tab"
                aria-selected={isSelected()}
                aria-controls={panelId(index())}
                tabIndex={isSelected() ? 0 : -1}
                disabled={item.disabled === true}
                onClick={() => select(item.value)}
                onKeyDown={(event) => onTabKeyDown(event.currentTarget, event)}
              >
                <span class="text textLabel whitespace-nowrap">
                  {item.label}
                </span>
                <Show when={item.badge !== undefined}>
                  <span class="text textFootnote textNumeral text-text-secondary">
                    {String(item.badge)}
                  </span>
                </Show>
                <Show when={variant() === 'underline'}>
                  <UnderlineRule selected={isSelected()} />
                </Show>
              </button>
            );
          }}
        </For>
      </div>
      <For each={props.items}>
        {(item, index) => (
          <div
            class={spaced([
              'box focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2',
              item.value === selected() ? undefined : 'hidden',
            ])}
            id={panelId(index())}
            data-component={componentId('TabPanel')}
            role="tabpanel"
            aria-labelledby={tabId(index())}
            tabIndex={0}
            hidden={item.value !== selected()}
          >
            <Show when={item.value === selected()}>
              {props.children?.(item.value)}
            </Show>
          </div>
        )}
      </For>
    </div>
  );
}
