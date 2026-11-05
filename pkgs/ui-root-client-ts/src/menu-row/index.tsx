/** @jsxImportSource solid-js */

import type { LocalizedString } from '@pkgs/i18n-shared-ts/localized-string';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Match, Show, Switch } from 'solid-js';
import { ChevronDownIcon, ChevronRightIcon, ChevronUpIcon } from '../icons';
import type { TextLines } from '../text-classes';
import { textStyleClass } from '../text-classes';
import styles from './menu-row.module.css';

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
  /**
   * A control of its own at the row's far end, beside the row's press
   * target and never inside it (a "…" menu on a row that opens something).
   * The row stays one native button or link, the accessory another.
   */
  accessory?: JSX.Element | undefined;
  /** Hide the trailing disclosure chevron. Defaults to `false`. */
  hideChevron?: boolean | undefined;
  /**
   * Make the row a disclosure (WAI-ARIA): it shows or hides the rows after
   * it instead of going somewhere. The row announces `aria-expanded`, and
   * its chevron points down while closed and up while open. Pair with
   * `onClick` to toggle.
   */
  expanded?: boolean | undefined;
  /** Render the row in its "current selection" state. */
  selected?: boolean | undefined;
  /**
   * `destructive` paints the title in the destructive ink: an action that
   * ends or removes something (sign out everywhere, delete). The row stays
   * calm otherwise; its confirmation carries the weight. Default `default`.
   */
  tone?: 'default' | 'destructive' | undefined;
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

function MenuRowChevron(props: {
  expanded: boolean | undefined;
  selected: boolean;
}): JSX.Element {
  const color = (): string => (props.selected ? 'tint' : 'icon');
  return (
    <Switch>
      <Match when={props.expanded === undefined}>
        <ChevronRightIcon size={20} color={color()} />
      </Match>
      <Match when={props.expanded === true}>
        <ChevronUpIcon size={20} color={color()} />
      </Match>
      <Match when={props.expanded === false}>
        <ChevronDownIcon size={20} color={color()} />
      </Match>
    </Switch>
  );
}

function MenuRowTrailing(props: {
  value: JSX.Element | undefined;
  valueLines: TextLines | undefined;
  trailing: JSX.Element | undefined;
  hideChevron: boolean;
  expanded: boolean | undefined;
  selected: boolean;
}): JSX.Element {
  const end = (): JSX.Element => (
    <Show
      when={props.trailing !== undefined}
      fallback={
        <Show when={!props.hideChevron}>
          <MenuRowChevron expanded={props.expanded} selected={props.selected} />
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
      {/* Capped so a long value never crowds the title out of the row.
          Body size in the secondary ink: a value is read, not glossed. */}
      <div class="box flex-row items-center gap-2 max-w-9/20">
        <div
          class={`text text-text-secondary text-right shrink ${textStyleClass({ lines: props.valueLines ?? 1 })}`}
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
  const destructive = () => props.tone === 'destructive';
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
            class="text textBody textRowTitle line-clamp-1 max-w-full"
            classList={{
              'text-tint': selected(),
              'text-destructive': !selected() && destructive(),
              'text-text': !selected() && !destructive(),
            }}
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
          expanded={props.expanded}
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

function MenuRowLink(
  props: MenuRowProps & MenuRowPart & { href: string }
): JSX.Element {
  return (
    <a
      class={`clickable clickableTint ${rowClass(props.selected === true)}`}
      {...partAttrs(props.part, props.dataSet)}
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

/** `MenuRowAction`: the press target of a row whose accessory sits beside it. */
type MenuRowPart = { readonly part?: 'action' | undefined };

/** The host's `data-*`: the row's own, or its press target's beside an accessory. */
function partAttrs(
  part: MenuRowPart['part'],
  dataSet: MenuRowProps['dataSet']
) {
  return part === 'action'
    ? dataAttrs({ component: 'MenuRowAction' })
    : dataAttrs({ component: 'MenuRow', ...dataSet });
}

function MenuRowButton(props: MenuRowProps & MenuRowPart): JSX.Element {
  return (
    <button
      class={`clickable clickableTint ${rowClass(props.selected === true)}`}
      {...partAttrs(props.part, props.dataSet)}
      type={props.submit === undefined ? 'button' : 'submit'}
      name={props.submit?.name}
      value={props.submit?.value}
      onClick={() => props.onClick?.()}
      disabled={props.disabled === true}
      aria-label={props['aria-label']}
      aria-current={props.selected === true ? true : undefined}
      aria-expanded={props.expanded}
      classList={{ 'opacity-disabled': props.disabled === true }}
    >
      <MenuRowBody {...props} interactive />
    </button>
  );
}

/** The row's press target: a link, or a button that acts or submits. */
function MenuRowPressable(
  props: MenuRowProps & MenuRowPart & { host: MenuRowHost }
): JSX.Element {
  return (
    <Show
      when={props.host === 'link' ? props.href : undefined}
      fallback={<MenuRowButton {...props} />}
    >
      {(href) => <MenuRowLink {...props} href={href()} />}
    </Show>
  );
}

/**
 * A pressable row with an accessory: the row's press target fills the
 * row, the accessory sits beside it on the same hairline, so neither
 * control nests in the other.
 */
function MenuRowSplit(
  props: MenuRowProps & { host: MenuRowHost }
): JSX.Element {
  return (
    <div
      class={`${styles['split']} box flex-row items-stretch ${rowClass(props.selected === true)}`}
      {...dataAttrs({ component: 'MenuRow', ...props.dataSet })}
    >
      <div class={`${styles['action']} box flex-1 min-w-0`}>
        <MenuRowPressable {...props} part="action" />
      </div>
      <div class="panelRule box flex-row items-center shrink-0 pr-2">
        {props.accessory}
      </div>
    </div>
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
 * An `accessory` (a "…" menu) sits at the row's end beside its press
 * target, never inside it, on the same hairline.
 * Pass `selected` to opt into a `tintSubtle` row fill; `tone="destructive"`
 * paints the title in the destructive ink. `submit` carries
 * `name=value` into the surrounding form. `expanded` makes the row a
 * disclosure for the rows after it (a down / up chevron, `aria-expanded`).
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
  const split = () => props.accessory !== undefined && host() !== 'static';
  return (
    <Switch>
      <Match when={split()}>
        <MenuRowSplit {...props} host={host()} />
      </Match>
      <Match when={host() !== 'static'}>
        <MenuRowPressable {...props} host={host()} />
      </Match>
      <Match when={host() === 'static'}>
        <div
          class={`box ${rowClass(props.selected === true)}`}
          {...dataAttrs({ component: 'MenuRow', ...props.dataSet })}
          aria-label={props['aria-label']}
          aria-current={props.current === true ? 'true' : undefined}
        >
          <MenuRowBody
            {...props}
            trailing={
              props.accessory === undefined ? (
                props.trailing
              ) : (
                <div class="box flex-row items-center gap-2">
                  {props.trailing}
                  {props.accessory}
                </div>
              )
            }
            interactive={false}
          />
        </div>
      </Match>
    </Switch>
  );
}
