/** @jsxImportSource solid-js */
/**
 * `EmbeddedScreen` -- a screen that lives inside a host's chrome.
 *
 * The host (a space, a tab shell) already owns the one top bar: its title,
 * its back control and its actions. A screen shown inside it never paints a
 * second bar. It scrolls, keeps one content width, and may open with a title
 * block in the body. Back navigation is registered with the host, not drawn
 * here.
 *
 * Every in-host template composes this one, so they share the same edge
 * padding, width and title treatment: `MainMenuScreen` (a menu of
 * destinations) and `GameScreen` (a game).
 *
 * @example
 * ```tsx
 * <EmbeddedScreen screenId="chess-stats" title="Puzzle stats">
 *   <MenuSection … />
 * </EmbeddedScreen>
 * ```
 */

import type { ComponentDataSet } from '@pkgs/ui-root-shared/component-id';
import type { JSX } from 'solid-js';
import { useScreenFocus } from './screen-focus';
import { ScreenIntro } from './screen-intro';
import type { ScreenMeasure } from './screen-measure';
import { ScrollView } from './scroll-view';

export type EmbeddedScreenProps = {
  /** Stable screen identifier rendered as `data-screen` (spec / dev tooling). */
  screenId: string;
  /** Body title (`h1`). Omit when the host's bar already names this screen. */
  title?: JSX.Element | undefined;
  /** One quiet line under the title. */
  subtitle?: JSX.Element | undefined;
  /** Content width cap. Defaults to `reading`. */
  width?: ScreenMeasure | undefined;
  children: JSX.Element;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

export function EmbeddedScreen(props: EmbeddedScreenProps): JSX.Element {
  let root: HTMLDivElement | undefined;
  useScreenFocus(
    () => root,
    () => props.screenId
  );
  return (
    <ScrollView
      ref={(el) => {
        root = el;
      }}
      grow
      self="stretch"
      width="full"
      dataSet={{
        component: 'EmbeddedScreen',
        ...props.dataSet,
        screen: props.screenId,
      }}
      paddingX="lg"
      paddingTop="sm"
      paddingBottom="2xl"
      gap="lg"
      measure={props.width ?? 'reading'}
    >
      <ScreenIntro title={props.title} subtitle={props.subtitle} />
      {props.children}
    </ScrollView>
  );
}
