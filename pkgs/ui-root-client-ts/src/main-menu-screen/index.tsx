/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { For, type JSX, Show } from 'solid-js';
import { EmbeddedScreen } from '../embedded-screen/index';
import type { MainMenuItem } from '../main-menu-item-row/index';
import { MainMenuItemRow } from '../main-menu-item-row/index';
import { createScreenSlot } from '../screen-slot';
import { useLayoutMode } from '../use-layout-mode';

export type MainMenuScreenProps = {
  /** Stable screen identifier rendered as `data-screen` (spec / dev tooling). */
  screenId: string;
  title?: JSX.Element | undefined;
  subtitle?: JSX.Element | undefined;
  /** Shown above the menu list (e.g. permissions hint). */
  helper?: JSX.Element | undefined;
  items: readonly MainMenuItem[];
  /** Below the list (e.g. secondary actions). */
  footer?: JSX.Element | undefined;
  /**
   * Wide layouts only. `list` (default): one panel of rows in the page
   * column. `grid`: each destination is its own card in a three-column grid
   * across the frame — for menus of places to go (games, ways to play), not
   * settings. Two or four destinations take two columns so none is left
   * alone on a row.
   */
  wideLayout?: 'list' | 'grid' | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

/**
 * `MainMenuScreen` -- a menu of destinations inside a host's chrome: optional
 * title / subtitle / helper, one panel of rows (the same `.panel` every list
 * uses) or, wide with `wideLayout="grid"`, one card per destination across
 * the frame, and an optional footer. An `EmbeddedScreen`, so it shares that
 * template's width, padding and title block. Presentational; parents own
 * selection and navigation state. Back navigation belongs in the host's nav
 * chrome, not inside the menu.
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
export function MainMenuScreen(props: MainMenuScreenProps): JSX.Element {
  const helper = createScreenSlot(() => props.helper);
  const footer = createScreenSlot(() => props.footer);
  const mode = useLayoutMode();
  const grid = (): boolean => props.wideLayout === 'grid' && mode() === 'wide';
  // Two or four destinations fill two columns evenly; never strand one card.
  const twoColumns = (): boolean =>
    props.items.length === 2 || props.items.length === 4;
  return (
    <EmbeddedScreen
      screenId={props.screenId}
      title={props.title}
      subtitle={props.subtitle}
      width={grid() ? 'full' : undefined}
      dataSet={{ component: 'MainMenuScreen', ...props.dataSet }}
    >
      <Show when={helper.present()}>
        <div class="text textCaption">{helper.content()}</div>
      </Show>
      <Show
        when={grid()}
        fallback={
          <div class="panel self-stretch" role="list">
            <For each={props.items}>
              {(item) => (
                <div class="panelItem" role="listitem">
                  <MainMenuItemRow item={item} />
                </div>
              )}
            </For>
          </div>
        }
      >
        <div
          class="grid gap-3 self-stretch"
          classList={{
            'grid-cols-2': twoColumns(),
            'grid-cols-3': !twoColumns(),
          }}
          role="list"
          data-layout="grid"
        >
          <For each={props.items}>
            {(item) => (
              <div class="panel" role="listitem">
                <MainMenuItemRow item={item} />
              </div>
            )}
          </For>
        </div>
      </Show>
      <Show when={footer.present()}>
        <div class="box mt-2">{footer.content()}</div>
      </Show>
    </EmbeddedScreen>
  );
}
