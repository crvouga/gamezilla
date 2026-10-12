/** @jsxImportSource solid-js */

/**
 * `MainMenuScreen` -- a menu of destinations inside a host's chrome: optional
 * title / subtitle / helper, one panel of rows (the same `.panel` every list
 * uses), and an optional footer. An `EmbeddedScreen`, so it shares that
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

import type { ComponentDataSet } from '@pkgs/ui-root-shared/component-id';
import { For, type JSX, Show } from 'solid-js';
import { EmbeddedScreen } from './embedded-screen';
import type { MainMenuItem } from './main-menu-item-row';
import { MainMenuItemRow } from './main-menu-item-row';

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
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

export function MainMenuScreen(props: MainMenuScreenProps): JSX.Element {
  return (
    <EmbeddedScreen
      screenId={props.screenId}
      title={props.title}
      subtitle={props.subtitle}
      dataSet={{ component: 'MainMenuScreen', ...props.dataSet }}
    >
      <Show when={props.helper}>
        <p class="text textCaption">{props.helper}</p>
      </Show>
      <div class="panel self-stretch" role="list">
        <For each={props.items}>
          {(item) => (
            <div class="panelItem" role="listitem">
              <MainMenuItemRow item={item} />
            </div>
          )}
        </For>
      </div>
      <Show when={props.footer}>
        <div class="box mt-2">{props.footer}</div>
      </Show>
    </EmbeddedScreen>
  );
}
