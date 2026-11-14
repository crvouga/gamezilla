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
  /**
   * The floating handle: what it says, and where a press goes. Leave it out
   * while there is nowhere to switch to (one view and no other): a handle
   * that does nothing is not drawn.
   */
  readonly handle?: AppStageHandleProps | undefined;
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
      // Out of sight, not out of the layout: a view that is not on show
      // keeps its size, so an app that lays itself out by the room it has
      // is already laid out when its turn comes, with nothing to flash.
      classList={{
        'invisible pointer-events-none z-0': !props.shown,
        'z-1': props.shown,
      }}
      inert={!props.shown}
      aria-hidden={!props.shown}
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
 * - **Press the handle** to switch (`handle.onTap`, to the next view): it is
 *   a plain switcher and nothing else, however long it is held. Anything
 *   more than switching belongs in a view of its own that it switches to.
 * - **Drag the handle** out of the way; let go and it rests against the
 *   nearer side, where it stays through a resize or a turn of the screen.
 *
 * Views never move in the document and a hidden view stays mounted and laid
 * out at full size (it is only made invisible and inert), so an app keeps its
 * state, its scroll position and its connections while another is on show,
 * and is already the right shape the moment it is shown. A `live` view is mounted from the start; any other is mounted
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
 *     label: t`Alice is on show. Press for the next.`,
 *     onTap: () => setShown(next(shown())),
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
      <Show when={props.handle}>
        {(handle) => <AppStageHandle {...handle()} />}
      </Show>
    </div>
  );
}
