/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import { useScreenFocus } from '../screen-focus/index';
import { ScreenIntro } from '../screen-intro/index';
import type { ScreenMeasure } from '../screen-measure';
import { ScrollView } from '../scroll-view/index';
import { useLayoutMode } from '../use-layout-mode';

export type EmbeddedScreenProps = {
  /** Stable screen identifier rendered as `data-screen` (spec / dev tooling). */
  screenId: string;
  /** Body title (`h1`). Omit when the host's bar already names this screen. */
  title?: JSX.Element | undefined;
  /** One quiet line under the title. */
  subtitle?: JSX.Element | undefined;
  /** The body column's measure. Defaults to `menu`. */
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
 * destinations) and `GameScreen` (a game). The body is one column at the
 * screen's measure (`menu` unless the template asks for `full`), its title
 * block inside it. A capped column is centered in every host, title included,
 * retaining the 16px page inset on narrow screens. A `full` column spans
 * the frame.
 *
 * @example
 * ```tsx
 * <EmbeddedScreen screenId="chess-stats" title="Puzzle stats">
 *   <MenuSection … />
 * </EmbeddedScreen>
 * ```
 */
export function EmbeddedScreen(props: EmbeddedScreenProps): JSX.Element {
  const mode = useLayoutMode();
  const inset = (): boolean => mode() !== 'wide';
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
              ? 'box flex-1 min-h-0 self-stretch min-w-0 gap-ui-lg pt-ui-sm'
              : 'box self-stretch min-w-0 gap-4'
          }
          classList={{ 'px-ui-lg': props.fill === true && inset() }}
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
        inset={inset()}
        setRoot={(el) => {
          root = el;
        }}
      />
    </Show>
  );
}

function ScrolledEmbeddedScreen(
  props: EmbeddedScreenProps & {
    inset: boolean;
    setRoot: (el: HTMLDivElement) => void;
  }
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
      paddingX={props.inset ? 'lg' : undefined}
      paddingTop="sm"
      paddingBottom="2xl"
      gap="lg"
      measure={props.width ?? 'menu'}
      measureAlign="center"
    >
      <ScreenIntro title={props.title} subtitle={props.subtitle} />
      {props.children}
    </ScrollView>
  );
}
