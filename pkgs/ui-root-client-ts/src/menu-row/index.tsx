/** @jsxImportSource solid-js */

import type { LocalizedString } from '@pkgs/i18n-shared-ts/localized-string';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Match, Show, Switch } from 'solid-js';
import { ChevronRightIcon } from '../icons';
import type { TextLines } from '../text-classes';
import { textStyleClass } from '../text-classes';

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
  /**
   * Lines the `value` may wrap to before it ends in an ellipsis. Default
   * `1`; a detail row whose value is a timestamp or a version takes more.
   */
  valueLines?: TextLines | undefined;
  /** Replace the default trailing chevron with custom content. */
  trailing?: JSX.Element | undefined;
  /** Hide the trailing disclosure chevron. Defaults to `false`. */
  hideChevron?: boolean | undefined;
  /** Render the row in its "current selection" state. */
  selected?: boolean | undefined;
  /**
   * Announce a static row as the current item of its set
   * (`aria-current="true"`), e.g. the plan a person is on. Interactive rows
   * announce `selected` instead.
   */
  current?: boolean | undefined;
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

function MenuRowTrailing(props: {
  value: JSX.Element | undefined;
  valueLines: TextLines | undefined;
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
      {/* Capped so a long value never crowds the title out of the row. */}
      <div class="box flex-row items-center gap-2 max-w-9/20">
        <div
          class={`text textCaption text-right shrink ${textStyleClass({ lines: props.valueLines ?? 1 })}`}
        >
          {props.value}
        </div>
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
    <div class="box flex-row items-stretch pl-4 min-h-13">
      <Show when={props.leading !== undefined}>
        <div class="box items-center justify-center min-w-6 shrink-0 py-3 pr-3">
          {props.leading}
        </div>
      </Show>
      {/* The text column draws the hairline above the row (`.panelRule`). */}
      <div class="panelRule box flex-1 min-w-0 flex-row items-center gap-3 py-3 pr-4">
        <div class="box flex-1 min-w-0 items-start">
          {/* `div`, not `p`: callers pass their own text blocks, and a `p`
              may not contain one. A long title ends in an ellipsis. */}
          <div
            class="text textBody line-clamp-1 max-w-full"
            classList={{ 'text-tint': selected(), 'text-text': !selected() }}
          >
            {props.title}
          </div>
          <Show when={props.caption}>
            <div class="text textCaption max-w-full">{props.caption}</div>
          </Show>
        </div>
        <MenuRowTrailing
          value={props.value}
          valueLines={props.valueLines}
          trailing={props.trailing}
          hideChevron={props.hideChevron === true || !props.interactive}
          selected={selected()}
        />
      </div>
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
      name={props.submit?.name}
      value={props.submit?.value}
      onClick={() => props.onClick?.()}
      disabled={props.disabled === true}
      aria-label={props['aria-label']}
      aria-current={props.selected === true ? true : undefined}
      classList={{ 'opacity-disabled': props.disabled === true }}
    >
      <MenuRowBody {...props} interactive />
    </button>
  );
}

/**
 * `MenuRow` -- a tappable navigation row with title, optional caption, and a
 * trailing disclosure chevron.
 *
 * One anatomy for every row in the product: at least 52px tall with 16px
 * insets, a 24px leading slot (icons in the `icon` tone, or an avatar), a
 * one-line `textBody` title that ends in an ellipsis, an optional caption,
 * an optional right-aligned secondary value, and a 20px trailing chevron.
 * Rows live inside a panel (`MenuList`), which owns the surface and the
 * radius; a row never paints its own. The hairline above a row starts at its
 * text column, past the leading slot.
 * Hover and press fade a tint in over 150ms, keyboard focus draws the ring
 * inside the panel, and a disabled row fades to the disabled opacity.
 *
 * Interactive rows use native buttons and links. Static detail rows and rows
 * whose trailing control owns the interaction use plain boxes. `MenuList`
 * groups these mixed controls without imposing command-menu keyboard semantics.
 * Pass `selected` to opt into a `tintSubtle` row fill. `submit` carries
 * `name=value` into the surrounding form.
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
          aria-current={props.current === true ? 'true' : undefined}
        >
          <MenuRowBody {...props} interactive={false} />
        </div>
      </Match>
    </Switch>
  );
}
