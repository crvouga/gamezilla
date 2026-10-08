/** @jsxImportSource solid-js */
/**
 * `MenuRow` -- a tappable navigation row with title, optional caption, and a
 * trailing disclosure chevron.
 *
 * One anatomy for every row in the product: a 28px leading slot, a title in
 * the display face, an optional caption, an optional right-aligned value,
 * and a trailing chevron. Rows live inside a panel (`MenuList`), which owns
 * the surface, the radius and the hairlines; a row never paints its own.
 *
 * Interactive rows (`onClick`) are `Clickable`s with `role="menuitem"` (host
 * them inside `MenuList`, which is `role="menu"`); hover / press tints come
 * from the default `'tint'` feedback. Static rows (key/value detail, rows
 * whose trailing control owns the interaction) are plain boxes. Pass
 * `selected` to opt into a `tintSubtle` row fill.
 *
 * Two more hosts keep the row's look for markup that must work without
 * JavaScript: `href` renders an `<a>` (an `onClick` alongside it intercepts
 * the navigation), and `submit` renders a submit `<button>` carrying
 * `name=value` into its form. Neither takes `role="menuitem"`, so they sit in
 * ordinary lists and forms.
 *
 * @example
 * ```tsx
 * <MenuRow
 *   title="Appearance"
 *   caption="Light, dark, or system theme"
 *   onClick={() => router.push('/more/theme')}
 * />
 * ```
 */

import type { LocalizedString } from '@pkgs/i18n-shared/localized-string';
import type { ComponentDataSet } from '@pkgs/ui-root-shared/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import { type JSX, Match, Show, Switch } from 'solid-js';
import { ChevronRightIcon } from './icons';

export type MenuRowSubmit = {
  readonly name: string;
  readonly value: string;
};

export type MenuRowProps = {
  title: JSX.Element;
  caption?: JSX.Element | undefined;
  /** Rendered before the title (e.g. an icon or avatar). */
  leading?: JSX.Element | undefined;
  /**
   * Secondary value shown right-aligned before the chevron (e.g. `Dark`,
   * `1.2.0`). Use for key/value detail rows and current-choice rows.
   */
  value?: JSX.Element | undefined;
  /** Replace the default trailing chevron with custom content. */
  trailing?: JSX.Element | undefined;
  /** Hide the trailing disclosure chevron. Defaults to `false`. */
  hideChevron?: boolean | undefined;
  /** Render the row in its "current selection" state. */
  selected?: boolean | undefined;
  onClick?: (() => void) | undefined;
  /** Render as a link to this URL. */
  href?: string | undefined;
  /**
   * Render as a submit button for the enclosing form, posting
   * `name=value` — how a list of choices submits the one picked.
   */
  submit?: MenuRowSubmit | undefined;
  disabled?: boolean | undefined;
  'aria-label'?: LocalizedString | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

/** Cap so a long value never crowds the title out of the row. */
const MENU_ROW_VALUE_MAX_WIDTH = '45%';

function MenuRowTrailing(props: {
  value: JSX.Element | undefined;
  trailing: JSX.Element | undefined;
  hideChevron: boolean;
  selected: boolean;
}): JSX.Element {
  const end = (): JSX.Element => (
    <Show
      when={props.trailing !== undefined}
      fallback={
        <Show when={!props.hideChevron}>
          <ChevronRightIcon
            size={20}
            color={props.selected ? 'tint' : 'icon'}
          />
        </Show>
      }
    >
      {props.trailing}
    </Show>
  );
  return (
    <Show
      when={props.value !== undefined && props.value !== null}
      fallback={end()}
    >
      <div
        class="box flex-row items-center gap-2"
        style={{ 'max-width': MENU_ROW_VALUE_MAX_WIDTH }}
      >
        <p class="text line-clamp-1 text-text-secondary text-right shrink">
          {props.value}
        </p>
        {end()}
      </div>
    </Show>
  );
}

function MenuRowBody(
  props: MenuRowProps & { interactive: boolean }
): JSX.Element {
  const selected = () => props.selected === true;
  return (
    <div
      class="box flex-row items-center px-4 py-3 gap-3 min-h-14"
      classList={{ panelLeading: props.leading !== undefined }}
    >
      <Show when={props.leading !== undefined}>
        <div class="box items-center justify-center w-7 shrink-0">
          {props.leading}
        </div>
      </Show>
      <div class="box flex-1 min-w-0 gap-0.5 items-start">
        <p
          class="text textLabel text-text"
          classList={{ 'text-tint': selected() }}
        >
          {props.title}
        </p>
        <Show when={props.caption}>
          <p class="text textCaption">{props.caption}</p>
        </Show>
      </div>
      <MenuRowTrailing
        value={props.value}
        trailing={props.trailing}
        hideChevron={props.hideChevron === true || !props.interactive}
        selected={selected()}
      />
    </div>
  );
}

function rowClass(selected: boolean): string {
  return selected ? 'bg-tint-subtle' : '';
}

type MenuRowHost = 'static' | 'action' | 'link' | 'submit';

function menuRowHost(
  row: Pick<MenuRowProps, 'href' | 'submit' | 'onClick'>
): MenuRowHost {
  if (row.href !== undefined) return 'link';
  if (row.submit !== undefined) return 'submit';
  return row.onClick === undefined ? 'static' : 'action';
}

function MenuRowLink(props: MenuRowProps & { href: string }): JSX.Element {
  return (
    <a
      class={`clickable clickableTint ${rowClass(props.selected === true)}`}
      {...dataAttrs({ component: 'MenuRow', ...props.dataSet })}
      href={props.href}
      onClick={(event) => {
        if (props.onClick === undefined) return;
        event.preventDefault();
        props.onClick();
      }}
      aria-label={props['aria-label']}
      aria-current={props.selected === true ? 'page' : undefined}
    >
      <MenuRowBody {...props} interactive />
    </a>
  );
}

function MenuRowButton(props: MenuRowProps): JSX.Element {
  return (
    <button
      class={`clickable clickableTint ${rowClass(props.selected === true)}`}
      {...dataAttrs({ component: 'MenuRow', ...props.dataSet })}
      type={props.submit === undefined ? 'button' : 'submit'}
      role={props.submit === undefined ? 'menuitem' : undefined}
      name={props.submit?.name}
      value={props.submit?.value}
      onClick={() => props.onClick?.()}
      disabled={props.disabled === true}
      aria-label={props['aria-label']}
      aria-current={props.selected === true ? true : undefined}
      style={{ opacity: props.disabled === true ? 0.5 : 1 }}
    >
      <MenuRowBody {...props} interactive />
    </button>
  );
}

export function MenuRow(props: MenuRowProps): JSX.Element {
  const host = (): MenuRowHost =>
    menuRowHost({
      href: props.href,
      submit: props.submit,
      onClick: props.onClick,
    });
  return (
    <Switch>
      <Match when={host() === 'link' ? props.href : undefined}>
        {(href) => <MenuRowLink {...props} href={href()} />}
      </Match>
      <Match when={host() === 'submit' || host() === 'action'}>
        <MenuRowButton {...props} />
      </Match>
      <Match when={host() === 'static'}>
        <div
          class={`box ${rowClass(props.selected === true)}`}
          {...dataAttrs({ component: 'MenuRow', ...props.dataSet })}
          aria-label={props['aria-label']}
        >
          <MenuRowBody {...props} interactive={false} />
        </div>
      </Match>
    </Switch>
  );
}
