/** @jsxImportSource solid-js */
import { cssPx } from '@pkgs/ui-root-shared/css-px';

/**
 * `MainMenuScreen` -- centered card-list main menu: optional title / subtitle /
 * helper, a vertical stack of pressable surface cards, and an optional footer.
 * Content is capped at {@link MAIN_MENU_SCREEN_MAX_WIDTH}. Fills the parent and
 * scrolls when the list exceeds the available height. Presentational; parents
 * own selection and navigation state. Back navigation belongs in the host's
 * nav chrome (`ScreenBase` breadcrumbs), not inside the menu.
 *
 * @example
 * ```tsx
 * <MainMenuScreen
 *   screenId="space-menu"
 *   title="Play"
 *   items={[{ key: 'chess', title: 'Chess', onClick: openChess }]}
 * />
 * ```
 */

import type { ComponentDataSet } from '@pkgs/ui-root-shared/component-id';
import { For, type JSX, Show } from 'solid-js';
import type { MainMenuItem } from './main-menu-item-row';
import { MainMenuItemRow } from './main-menu-item-row';
import { MainMenuScreenHeader } from './main-menu-screen-header';
import { ScrollView } from './scroll-view';

export type MainMenuScreenProps = {
  title?: JSX.Element | undefined;
  subtitle?: JSX.Element | undefined;
  /** Shown above the menu list (e.g. permissions hint). */
  helper?: JSX.Element | undefined;
  items: readonly MainMenuItem[];
  /** Below the list (e.g. secondary actions). */
  footer?: JSX.Element | undefined;
  /**
   * Stable screen identifier rendered as `data-screen` on the root (dev/spec).
   * Prefer setting this for every top-level menu screen.
   */
  screenId?: string | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

/** Shared max content width for every {@link MainMenuScreen}. */
export const MAIN_MENU_SCREEN_MAX_WIDTH = 480;

export function MainMenuScreen(props: MainMenuScreenProps): JSX.Element {
  const dataSet = (): ComponentDataSet => ({
    component: 'MainMenuScreen',
    ...props.dataSet,
    ...(props.screenId !== undefined ? { screen: props.screenId } : {}),
  });
  return (
    <ScrollView
      class="flex-1 self-stretch w-full"
      dataSet={dataSet()}
      contentClass="box px-4 pb-8 pt-4 gap-4 self-center w-full"
      contentStyle={{ 'max-width': cssPx(MAIN_MENU_SCREEN_MAX_WIDTH) }}
    >
      <MainMenuScreenHeader title={props.title} subtitle={props.subtitle} />
      <Show when={props.helper}>
        <p class="text text-text-secondary text-center opacity-75">
          {props.helper}
        </p>
      </Show>
      <div class="box self-stretch gap-2" role="list">
        <For each={props.items}>
          {(item) => (
            <div class="box" role="listitem">
              <MainMenuItemRow item={item} />
            </div>
          )}
        </For>
      </div>
      <Show when={props.footer}>
        <div class="box mt-2">{props.footer}</div>
      </Show>
    </ScrollView>
  );
}
