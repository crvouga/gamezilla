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
   * One short fact beside the title, as a small neutral tag (`2 players`).
   * Rows of one menu give it all or none, so it reads as a column.
   */
  meta?: JSX.Element | string | undefined;
  /** Before the title: a `GameTile` or an icon that says what the row is. */
  leading?: JSX.Element | undefined;
  /** Overrides the default trailing affordance (chevron / selection check). */
  trailing?: JSX.Element | undefined;
  selected?: boolean | undefined;
  disabled?: boolean | undefined;
  onClick?: (() => void) | undefined;
  /** DOM `data-*` identifiers for the row. */
  dataSet?: ComponentDataSet | undefined;
};

function DefaultTrailing(props: { selected: boolean }): JSX.Element {
  return (
    <div class="box flex-row items-center gap-2">
      <Show when={props.selected}>
        <CircleCheckIcon size={20} color="tint" />
      </Show>
      <ChevronRightIcon size={20} color="icon" />
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
          <DefaultTrailing selected={props.item.selected === true} />
        </Show>
      }
    >
      {props.item.trailing}
    </Show>
  );
}

function ItemBody(props: {
  item: MainMenuItem;
  interactive: boolean;
}): JSX.Element {
  const disabled = (): boolean => props.item.disabled === true;
  const captionInTrailing = (): boolean =>
    disabled() && props.item.caption !== undefined;
  return (
    <div
      class="box flex-row items-stretch pl-4 min-h-14"
      classList={{ 'opacity-disabled': disabled() }}
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
          <div class="box flex-row items-center gap-2 min-w-0 max-w-full">
            <p class="text textLabel line-clamp-1 min-w-0">
              {props.item.title}
            </p>
            <Show when={props.item.meta}>
              <Badge intent="neutral" size="sm" label={props.item.meta} />
            </Show>
          </div>
          <Show when={props.item.caption !== undefined && !captionInTrailing()}>
            <p class="text textCaption line-clamp-2 max-w-full">
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
export function MainMenuItemRow(props: { item: MainMenuItem }): JSX.Element {
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
          <ItemBody item={props.item} interactive={false} />
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
          <ItemBody item={props.item} interactive={interactive()} />
        </button>
      )}
    </Show>
  );
}
