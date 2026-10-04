/** @jsxImportSource solid-js */
import { cssPx } from '@pkgs/ui-shared/css-px';
/**
 * One card row of `MainMenuScreen`: title, optional caption, and a trailing
 * chevron / selection check. Interactive rows are pressable surface cards.
 */

import { createMemo, type JSX, Show } from 'solid-js';
import type { ComponentDataSet } from '@pkgs/ui-shared/component-id';
import { dataAttrs } from '@pkgs/ui-shared/component-id';
import { useThemeTokens } from './theme-context';
import { GradientBox } from './gradient-box';
import { ChevronRightIcon, CircleCheckIcon } from './icons';
import { resolveNeutralGradient } from '@pkgs/ui-shared/main-menu-gradient';

export type MainMenuItem = {
  /** Stable id for list keys. */
  key: string;
  title: JSX.Element | string;
  caption?: JSX.Element | string | undefined;
  /** Overrides the default trailing affordance (chevron / selection check). */
  trailing?: JSX.Element | undefined;
  selected?: boolean | undefined;
  disabled?: boolean | undefined;
  onClick?: (() => void) | undefined;
  /** DOM `data-*` identifiers for the row. */
  dataSet?: ComponentDataSet | undefined;
};

const MENU_ITEM_MIN_HEIGHT = 84;

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
  const tokens = useThemeTokens();
  const gradient = createMemo(() =>
    resolveNeutralGradient(tokens.palette().surfaceElevated)
  );
  const disabled = (): boolean => props.item.disabled === true;
  const captionInTrailing = (): boolean =>
    disabled() && props.item.caption !== undefined;
  return (
    <div
      class="box py-4 px-4 justify-center rounded-card border border-solid border-border bg-surface-elevated overflow-hidden"
      style={{
        'min-height': cssPx(MENU_ITEM_MIN_HEIGHT),
        opacity: disabled() ? 0.5 : 1,
      }}
    >
      <GradientBox
        class="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        colors={[gradient().top, gradient().bottom]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <div class="box relative z-1 flex-row items-center gap-3">
        <div class="box flex-1 gap-1 items-start">
          <p class="text textBodyBold">{props.item.title}</p>
          <Show when={props.item.caption !== undefined && !captionInTrailing()}>
            <p class="text textCaption text-text-secondary">
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
          <p class="text textCaption text-text-secondary italic">
            {props.item.caption}
          </p>
        </Show>
      </div>
    </div>
  );
}

export function MainMenuItemRow(props: { item: MainMenuItem }): JSX.Element {
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
          class="clickable clickableTint rounded-card items-stretch"
          {...dataAttrs({ component: 'MainMenuItem', ...props.item.dataSet })}
          type="button"
          onClick={() => onClick()()}
          disabled={props.item.disabled === true}
          aria-pressed={props.item.selected === true ? true : undefined}
        >
          <ItemBody item={props.item} interactive={interactive()} />
        </button>
      )}
    </Show>
  );
}
