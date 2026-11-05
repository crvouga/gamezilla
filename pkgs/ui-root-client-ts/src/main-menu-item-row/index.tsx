/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import { Badge } from '../badge/index';
import { ChevronRightIcon, CircleCheckIcon } from '../icons';
import { useConfirmNavigation } from '../pending-navigation';

export type MainMenuItem = {
  /** Stable id for list keys. */
  key: string;
  title: JSX.Element | string;
  caption?: JSX.Element | string | undefined;
  /**
   * One short fact about the row, as a tag right after the title (`2
   * players`), wrapping under it only when the line is too short; the
   * `primary` row's tag (`Recommended`) is in the accent. Rows of one menu
   * give it all or none, so it reads alike down the list.
   */
  meta?: JSX.Element | string | undefined;
  /**
   * Where `meta` sits: `title` (default) beside the title; `above` over the
   * title as a small heading of the row, for a title too long to share its
   * line with the tag on a phone, so the tag neither splits the title from
   * its caption nor interrupts the caption's sentence.
   */
  metaPlacement?: 'title' | 'above' | undefined;
  /** Before the title: a `GameTile` or an icon that says what the row is. */
  leading?: JSX.Element | undefined;
  /** Overrides the default trailing affordance (chevron / selection check). */
  trailing?: JSX.Element | undefined;
  selected?: boolean | undefined;
  disabled?: boolean | undefined;
  /**
   * How strongly the row asks to be chosen among its menu's rows:
   * `primary` (the one main way in) leads with a tinted chevron, never a
   * fill, which would read as already chosen; `quiet` (a look back, a
   * setting) keeps its title's ink, so it never reads as disabled, and only
   * says less: its caption is one line. Unset is an ordinary row. One
   * `primary` per menu at most.
   */
  emphasis?: 'primary' | 'quiet' | undefined;
  onClick?: (() => void) | undefined;
  /** DOM `data-*` identifiers for the row. */
  dataSet?: ComponentDataSet | undefined;
};

function DefaultTrailing(props: {
  selected: boolean;
  primary: boolean;
}): JSX.Element {
  return (
    <div class="box flex-row items-center gap-2">
      <Show when={props.selected}>
        <CircleCheckIcon size={20} color="tint" />
      </Show>
      <ChevronRightIcon size={20} color={props.primary ? 'tint' : 'icon'} />
    </div>
  );
}

function ItemTrailing(props: {
  item: MainMenuItem;
  interactive: boolean;
}): JSX.Element {
  return (
    <Show
      when={props.item.trailing !== undefined}
      fallback={
        <Show when={props.interactive}>
          <DefaultTrailing
            selected={props.item.selected === true}
            primary={props.item.emphasis === 'primary'}
          />
        </Show>
      }
    >
      {props.item.trailing}
    </Show>
  );
}

/** The row's tag: in the accent for the `primary` row. */
function ItemMeta(props: { item: MainMenuItem }): JSX.Element {
  return (
    <Badge
      intent={props.item.emphasis === 'primary' ? 'brand' : 'neutral'}
      size="md"
      label={props.item.meta}
    />
  );
}

function ItemBody(props: {
  item: MainMenuItem;
  interactive: boolean;
}): JSX.Element {
  const disabled = (): boolean => props.item.disabled === true;
  const metaAbove = (): boolean =>
    props.item.metaPlacement === 'above' && props.item.meta !== undefined;
  const captionInTrailing = (): boolean =>
    disabled() && props.item.caption !== undefined;
  return (
    <div
      class="box flex-row items-stretch pl-4 min-h-14"
      classList={{
        'opacity-disabled': disabled(),
      }}
      data-emphasis={props.item.emphasis}
    >
      <Show when={props.item.leading}>
        <div class="box items-center justify-center shrink-0 py-2 pr-3">
          {props.item.leading}
        </div>
      </Show>
      {/* The text column draws the hairline above the row (`.panelRule`),
          so it starts past a leading picture. */}
      <div class="panelRule box flex-1 min-w-0 flex-row items-center gap-3 py-3 pr-4">
        <div class="box flex-1 min-w-0 items-start">
          <Show when={metaAbove()}>
            <div class="box pb-1">
              <ItemMeta item={props.item} />
            </div>
          </Show>
          <div class="box flex-row flex-wrap items-center gap-2 min-w-0 max-w-full">
            <p class="text textLabel line-clamp-1 min-w-0 max-w-full">
              {props.item.title}
            </p>
            <Show when={props.item.meta !== undefined && !metaAbove()}>
              <ItemMeta item={props.item} />
            </Show>
          </div>
          <Show when={props.item.caption !== undefined && !captionInTrailing()}>
            <p
              class="text textCaption max-w-full"
              classList={{
                'line-clamp-1': props.item.emphasis === 'quiet',
                'line-clamp-2': props.item.emphasis !== 'quiet',
              }}
            >
              {props.item.caption}
            </p>
          </Show>
        </div>
        <Show
          when={captionInTrailing()}
          fallback={
            <ItemTrailing item={props.item} interactive={props.interactive} />
          }
        >
          <p class="text textCaption line-clamp-1 shrink max-w-9/20">
            {props.item.caption}
          </p>
        </Show>
      </div>
    </div>
  );
}

/**
 * One destination as a tile of a wide grid (`layout="tile"`), read top to
 * bottom: its picture with the chevron at the far end, then its name and
 * tag, then what it is in up to two lines, so a short description never
 * leaves a wide card mostly empty.
 */
function TileBody(props: {
  item: MainMenuItem;
  interactive: boolean;
}): JSX.Element {
  return (
    <div
      class="box gap-3 p-4 h-full"
      classList={{ 'opacity-disabled': props.item.disabled === true }}
      data-emphasis={props.item.emphasis}
    >
      <div class="box flex-row items-start justify-between gap-3">
        <Show when={props.item.leading}>
          <div class="box shrink-0">{props.item.leading}</div>
        </Show>
        <ItemTrailing item={props.item} interactive={props.interactive} />
      </div>
      <div class="box gap-1 min-w-0 items-start">
        <div class="box flex-row flex-wrap items-center gap-2 min-w-0 max-w-full">
          <p class="text textLabel line-clamp-1 min-w-0 max-w-full">
            {props.item.title}
          </p>
          <Show when={props.item.meta !== undefined}>
            <ItemMeta item={props.item} />
          </Show>
        </div>
        <Show when={props.item.caption !== undefined}>
          <p class="text textCaption line-clamp-2 max-w-full">
            {props.item.caption}
          </p>
        </Show>
      </div>
    </div>
  );
}

/** The row's body in the layout its menu asks for. */
function Body(props: {
  item: MainMenuItem;
  interactive: boolean;
  layout: 'row' | 'tile';
}): JSX.Element {
  return (
    <Show
      when={props.layout === 'tile'}
      fallback={<ItemBody item={props.item} interactive={props.interactive} />}
    >
      <TileBody item={props.item} interactive={props.interactive} />
    </Show>
  );
}

/**
 * One row of `MainMenuScreen`: an optional leading picture (`leading`),
 * title with an optional short fact beside it (`meta`), optional caption,
 * and a trailing
 * chevron / selection check. Same anatomy as `MenuRow` (16px insets, 20px
 * secondary chevron, 150ms hover / press tint, focus ring inside the panel),
 * a little taller and with a `textLabel` title because each row is a
 * destination; the screen's panel owns the surface. The title is one line
 * and the caption two, each ending in an ellipsis. A disabled row fades to
 * the disabled opacity and moves its caption to the trailing edge.
 */
export function MainMenuItemRow(props: {
  item: MainMenuItem;
  /** `tile`: one card of a wide tile grid, read top to bottom. */
  layout?: 'row' | 'tile' | undefined;
}): JSX.Element {
  const confirmNavigation = useConfirmNavigation();
  const interactive = (): boolean =>
    props.item.onClick !== undefined && props.item.disabled !== true;
  return (
    <Show
      when={props.item.onClick}
      fallback={
        <div
          class="box"
          {...dataAttrs({ component: 'MainMenuItem', ...props.item.dataSet })}
        >
          <Body
            item={props.item}
            interactive={false}
            layout={props.layout ?? 'row'}
          />
        </div>
      }
    >
      {(onClick) => (
        <button
          class="clickable clickableTint items-stretch"
          {...dataAttrs({ component: 'MainMenuItem', ...props.item.dataSet })}
          type="button"
          onClick={() => confirmNavigation(() => onClick()())}
          disabled={props.item.disabled === true}
          aria-pressed={props.item.selected === true ? true : undefined}
        >
          <Body
            item={props.item}
            interactive={interactive()}
            layout={props.layout ?? 'row'}
          />
        </button>
      )}
    </Show>
  );
}
