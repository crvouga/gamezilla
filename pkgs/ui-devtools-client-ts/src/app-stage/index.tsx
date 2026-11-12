/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import {
  componentDataAttrs,
  componentId,
  dataAttrs,
} from '@pkgs/ui-root-shared-ts/component-id';
import { createEffect, createSignal, For, type JSX, Show } from 'solid-js';
import {
  AppStageHandle,
  type AppStageHandleProps,
} from '../app-stage-handle/index';

/** One view an `AppStage` can show. */
export type AppStageView = {
  /** Stable id; `shown` names a view by it. */
  readonly id: string;
  /** Accessible name of the view. */
  readonly title: string;
  /**
   * Mount the view at once and keep it running while another is on show
   * (an app that must stay live). Default `false`: the view is mounted the
   * first time it is shown, and kept after.
   */
  readonly live?: boolean | undefined;
  /** The view's content. Called once; the element then stays mounted. */
  readonly content: () => JSX.Element;
};

export type AppStageProps = {
  /** Every view the stage can show. Keep the order stable. */
  readonly views: readonly AppStageView[];
  /** The id of the view on show; `null` shows none. */
  readonly shown: string | null;
  /** Accessible name of the whole stage. */
  readonly 'aria-label': string;
  /** The floating handle: what it says, and what a press and a hold do. */
  readonly handle: AppStageHandleProps;
  readonly dataSet?: ComponentDataSet | undefined;
};

function StageView(props: {
  readonly view: AppStageView;
  readonly shown: boolean;
}): JSX.Element {
  const [seen, setSeen] = createSignal(false);
  createEffect(() => {
    if (props.shown) setSeen(true);
  });
  return (
    <section
      class="box absolute inset-0 overflow-hidden bg-background"
      classList={{ hidden: !props.shown }}
      aria-label={props.view.title}
      data-component={componentId('AppStageView')}
      {...dataAttrs({
        'stage-part': 'view',
        'view-id': props.view.id,
        'view-shown': String(props.shown),
      })}
    >
      <Show when={props.view.live === true || seen()}>
        {props.view.content()}
      </Show>
    </section>
  );
}

/**
 * `AppStage` -- one view at a time, edge to edge, under a single small
 * handle that floats over it. For looking at whole apps (a phone's screen, a
 * device in a test world) where any chrome around the app would be in its
 * way: there is no bar, no border and no tab; the handle is all there is.
 *
 * - **Press the handle** to go on (`handle.onTap`, usually to the next
 *   view). **Hold it**, right-click it, or press Up / Down on it to ask for
 *   more (`handle.onHold`, usually a menu of every view and the tools).
 * - **Drag the handle** out of the way; let go and it rests against the
 *   nearer side, where it stays through a resize or a turn of the screen.
 *
 * Views never move in the document and a hidden view stays mounted, so an
 * app keeps its state, its scroll position and its connections while another
 * is on show. A `live` view is mounted from the start; any other is mounted
 * the first time it is shown.
 *
 * The stage is controlled: it shows `shown` and reports presses; the caller
 * decides what comes next. For scripts and agents the root carries
 * `data-shown-view`, and every part `data-stage-part` (`view` with
 * `data-view-id` and `data-view-shown`, or `handle`), in every build.
 *
 * @example
 * ```tsx
 * const [shown, setShown] = createSignal('alice');
 * <AppStage
 *   aria-label={t`Devices`}
 *   shown={shown()}
 *   views={[
 *     { id: 'alice', title: t`Alice`, live: true, content: () => <App of="alice" /> },
 *     { id: 'bob', title: t`Bob`, live: true, content: () => <App of="bob" /> },
 *     { id: 'logs', title: t`Logs`, content: () => <Logs /> },
 *   ]}
 *   handle={{
 *     label: t`Alice is on show. Press for the next device, hold for the menu.`,
 *     text: 'al',
 *     expanded: menuOpen(),
 *     onTap: () => setShown(shown() === 'alice' ? 'bob' : 'alice'),
 *     onHold: () => setMenuOpen(true),
 *   }}
 * />
 * ```
 */
export function AppStage(props: AppStageProps): JSX.Element {
  return (
    <div
      class="box relative flex-1 min-w-0 min-h-0 overflow-hidden bg-background"
      role="group"
      aria-label={props['aria-label']}
      {...componentDataAttrs('AppStage', {
        'stage-part': 'stage',
        'shown-view': props.shown ?? '',
        ...props.dataSet,
      })}
    >
      <For each={props.views}>
        {(view) => <StageView view={view} shown={view.id === props.shown} />}
      </For>
      <AppStageHandle {...props.handle} />
    </div>
  );
}
