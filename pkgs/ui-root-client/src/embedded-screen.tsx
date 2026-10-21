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
import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import { type JSX, Show } from 'solid-js';
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
  /**
   * The host already scrolls and pads this body (a routed `ContentScreen`):
   * render the title block and the sections only, with no scroller and no
   * edge padding of its own, so the page has one scroller and one edge.
   */
  nested?: boolean | undefined;
  /**
   * The children scroll themselves (a list under a pinned search field, a
   * detail over a pinned footer): the screen is a fixed frame that fills
   * the host, with the same edge padding and title block and no scroller of
   * its own, so the page still has one scroller.
   */
  fill?: boolean | undefined;
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
    <Show
      when={props.nested !== true && props.fill !== true}
      fallback={
        <div
          ref={(el) => {
            root = el;
          }}
          class={
            props.fill === true
              ? 'box flex-1 min-h-0 self-stretch min-w-0 gap-ui-lg px-ui-lg pt-ui-sm'
              : 'box self-stretch min-w-0 gap-4'
          }
          {...dataAttrs({
            component: 'EmbeddedScreen',
            ...props.dataSet,
            screen: props.screenId,
          })}
        >
          <ScreenIntro title={props.title} subtitle={props.subtitle} />
          {props.children}
        </div>
      }
    >
      <ScrolledEmbeddedScreen
        {...props}
        setRoot={(el) => {
          root = el;
        }}
      />
    </Show>
  );
}

function ScrolledEmbeddedScreen(
  props: EmbeddedScreenProps & { setRoot: (el: HTMLDivElement) => void }
): JSX.Element {
  return (
    <ScrollView
      ref={(el) => {
        props.setRoot(el);
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
