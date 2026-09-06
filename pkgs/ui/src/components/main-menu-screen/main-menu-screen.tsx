/** @jsxImportSource solid-js */
/**
 * `MainMenuScreen` -- centered, card-based main menu: optional
 * title / subtitle / helper, a vertical stack of card rows, and an optional
 * footer. Content is capped at {@link MAIN_MENU_SCREEN_MAX_WIDTH} for visual
 * consistency across all space menus. Presentational; parents own selection
 * and navigation state. Back navigation belongs in the host's nav chrome
 * (`ScreenBase` breadcrumbs), not inside the menu.
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

import { For, type JSX, Show } from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import { Box } from '../box';
import { Text } from '../text';
import { type MainMenuItem, MainMenuItemRow } from './main-menu-item-row';
import { MainMenuScreenHeader } from './main-menu-screen-header';

export type MainMenuScreenProps = {
  title?: JSX.Element | undefined;
  subtitle?: JSX.Element | undefined;
  /** Shown above the menu list (e.g. permissions hint). */
  helper?: JSX.Element | undefined;
  items: readonly MainMenuItem[];
  /** Below the list (e.g. secondary actions). */
  footer?: JSX.Element | undefined;
  /**
   * Stable screen identifier rendered as `data-screen` on the root (dev/e2e).
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
    <Box
      dataSet={dataSet()}
      sx={{
        px: 4,
        pb: 8,
        pt: 4,
        gap: 4,
        alignSelf: 'center',
        width: '100%',
        maxWidth: MAIN_MENU_SCREEN_MAX_WIDTH,
      }}
    >
      <MainMenuScreenHeader title={props.title} subtitle={props.subtitle} />
      <Show when={props.helper}>
        <Text
          variant="body"
          sx={{ color: 'textSecondary', textAlign: 'center', opacity: 0.75 }}
          label={props.helper}
        />
      </Show>
      <Box role="list" sx={{ alignSelf: 'stretch', gap: 2 }}>
        <For each={props.items}>
          {(item) => (
            <Box role="listitem">
              <MainMenuItemRow item={item} />
            </Box>
          )}
        </For>
      </Box>
      <Show when={props.footer}>
        <Box sx={{ mt: 2 }}>{props.footer}</Box>
      </Show>
    </Box>
  );
}
