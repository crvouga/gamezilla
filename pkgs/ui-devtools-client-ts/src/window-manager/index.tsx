/** @jsxImportSource solid-js */

import {
  applyWindowLayoutCommand,
  pruneWindowLayout,
  type WindowLayout,
  type WindowLayoutCommand,
  windowById,
  windowOfPanel,
} from '@pkgs/ui-devtools-shared-ts/window-layout';
import { serializeWindowLayout } from '@pkgs/ui-devtools-shared-ts/window-layout-codec';
import {
  type WindowFrames,
  windowDropCommand,
  windowFrames,
} from '@pkgs/ui-devtools-shared-ts/window-layout-geometry';
import type { OverflowMenuAction } from '@pkgs/ui-root-client-ts/overflow-menu-button';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import {
  componentDataAttrs,
  dataAttrs,
} from '@pkgs/ui-root-shared-ts/component-id';
import {
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  For,
  type JSX,
  on,
  Show,
} from 'solid-js';
import {
  type WindowManagerApi,
  WindowManagerContext,
} from '../window-manager-context';
import { createWindowDrag } from '../window-manager-drag';
import {
  WindowManagerDropPreview,
  WindowManagerEmpty,
  WindowManagerPanelHost,
} from '../window-manager-parts/index';
import { WindowManagerSeparator } from '../window-manager-separator/index';
import { useWindowManagerText } from '../window-manager-text';
import type { WindowPanel } from '../window-manager-types';
import { WindowManagerWindow } from '../window-manager-window/index';

export type WindowManagerProps = {
  /**
   * Every panel the manager can show, open or closed. Keep the order stable:
   * it is the order of the panel elements in the document.
   */
  readonly panels: readonly WindowPanel[];
  /** Which windows exist, what they hold and how they are arranged. */
  readonly layout: WindowLayout;
  /**
   * The layout after a change, with the command that made it. Store the
   * layout and pass it back.
   */
  readonly onLayoutChange: (
    layout: WindowLayout,
    command: WindowLayoutCommand
  ) => void;
  /** Accessible name of the whole arrangement. */
  readonly 'aria-label': string;
  /**
   * One window at a time, with every panel in a single tab bar; splitting
   * and dragging are off. For narrow screens. Default `false`.
   */
  readonly compact?: boolean | undefined;
  /** Rows added to the end of every window's menu (reset the layout, ...). */
  readonly menuActions?: readonly OverflowMenuAction[] | undefined;
  readonly dataSet?: ComponentDataSet | undefined;
};

function sameLayout(a: WindowLayout, b: WindowLayout): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** The panel whose tab takes focus once `command` has been applied. */
function focusAfter(
  next: WindowLayout,
  command: WindowLayoutCommand
): string | null {
  if ('panel' in command && windowOfPanel(next, command.panel) !== null)
    return command.panel;
  return windowById(next, next.focused)?.active ?? null;
}

function createWindowManagerApi(
  props: WindowManagerProps,
  elements: {
    readonly root: () => HTMLElement | undefined;
    readonly frames: () => WindowFrames;
    readonly layout: () => WindowLayout;
  },
  say: (text: string) => void
): WindowManagerApi {
  const text = useWindowManagerText();
  const base = `ui-window-${createUniqueId()}`;
  const tabs = new Map<string, HTMLElement>();
  const byId = createMemo(
    () => new Map(props.panels.map((panel) => [panel.id, panel]))
  );
  let wanted: string | null = null;
  const focusTab = (): void => {
    const tab = wanted === null ? undefined : tabs.get(wanted);
    wanted = null;
    if (tab?.isConnected === true) tab.focus();
  };
  createEffect(on(elements.layout, focusTab, { defer: true }));
  const dispatch: WindowManagerApi['dispatch'] = (command, options) => {
    const before = elements.layout();
    const next = applyWindowLayoutCommand(before, command);
    if (options?.focus === true) wanted = focusAfter(next, command);
    if (sameLayout(before, next)) {
      focusTab();
      return;
    }
    const title =
      'panel' in command ? (byId().get(command.panel)?.title ?? '') : '';
    const said = text.announce(command, title);
    if (said !== null) say(said);
    props.onLayoutChange(next, command);
  };
  const drag = createWindowDrag({
    root: elements.root,
    frames: () => elements.frames().windows,
    enabled: () => props.compact !== true,
    tabsOf: (window, except) =>
      (windowById(elements.layout(), window)?.tabs ?? []).flatMap((id) => {
        const tab = id === except ? undefined : tabs.get(id);
        return tab?.isConnected === true ? [tab] : [];
      }),
    onDrop: (state) => {
      if (state.target === null) return;
      dispatch(
        windowDropCommand(state.panel, state.target, state.index ?? undefined)
      );
    },
  });
  return {
    layout: elements.layout,
    panel: (id) => byId().get(id),
    closed: () =>
      props.panels.filter(
        (panel) => windowOfPanel(elements.layout(), panel.id) === null
      ),
    compact: () => props.compact === true,
    dispatch,
    drag,
    bounds: () => elements.root()?.getBoundingClientRect(),
    tabId: (panel) => `${base}-tab-${encodeURIComponent(panel)}`,
    panelId: (panel) => `${base}-panel-${encodeURIComponent(panel)}`,
    hintId: `${base}-hint`,
    registerTab: (panel, element) => tabs.set(panel, element),
    focusPanel: (panel) =>
      elements
        .root()
        ?.querySelector<HTMLElement>(
          `[id="${base}-panel-${encodeURIComponent(panel)}"]`
        )
        ?.focus(),
    menuActions: () => props.menuActions ?? [],
  };
}

/**
 * `WindowManager` -- a tiling workspace of windows. Each window has its own
 * tab bar over one visible panel; windows sit side by side or stacked, with
 * draggable dividers between them.
 *
 * - **Arrange by dragging a tab**: onto another tab bar to join it (a marker
 *   shows where it lands), onto the middle of a window to join its tabs, or
 *   onto an edge of a window to open a new window on that side. Drag a tab
 *   back to a tab bar to merge the windows again. Escape cancels a drag.
 * - **Arrange by keyboard**, from a tab: Left / Right / Home / End switch
 *   tabs, Shift + Left / Right reorder, Alt + arrow goes to the window on
 *   that side, Alt + Shift + arrow moves the panel to that side (into the
 *   window there, or a new one), Delete closes, Down Arrow enters the panel.
 * - **Arrange by menu**: every window's "Window actions" menu splits, moves,
 *   maximizes and closes its visible panel, and takes the caller's
 *   `menuActions`. Closed panels come back from the "Open a panel" menu.
 * - **Resize**: drag a divider, or focus it and use the arrows (Shift for a
 *   large step, Home / End for the limits, Enter or a double click to even
 *   the split). Double-click a tab bar to maximize its window.
 *
 * The layout is controlled, plain, serializable data
 * (`@pkgs/ui-devtools-shared-ts/window-layout`): build one with
 * `createWindowLayout`, store what `onLayoutChange` hands back, and change it
 * from outside with `applyWindowLayoutCommand` -- the same commands the
 * pointer, the keys and the menus make. `serializeWindowLayout` /
 * `parseWindowLayout` turn it into a string for a URL or a preference.
 *
 * A panel's element is created when the panel opens and then never moves in
 * the document: windows are positioned over a flat list of panels, so an
 * embedded frame, a scroll position or an editor survive any rearrangement.
 * Background tabs stay mounted and hidden; a closed panel is unmounted.
 *
 * Accessibility: windows are labelled groups that own their panel; tab bars
 * follow the WAI-ARIA tabs pattern, dividers the window-splitter pattern;
 * every change that moves something is announced in a polite live region.
 *
 * For scripts and agents the root carries `data-layout` (the serialized
 * layout) and every part carries `data-window-part` with `data-window-id`,
 * `data-panel-id` or `data-split-id`, in every build.
 *
 * @example
 * ```tsx
 * const [layout, setLayout] = createSignal(
 *   createWindowLayout({ direction: 'row', children: [['editor'], ['preview', 'logs']] })
 * );
 * <WindowManager
 *   aria-label={t`Workspace`}
 *   panels={[
 *     { id: 'editor', title: t`Editor`, content: () => <Editor /> },
 *     { id: 'preview', title: t`Preview`, content: () => <Preview /> },
 *     { id: 'logs', title: t`Logs`, content: () => <Logs /> },
 *   ]}
 *   layout={layout()}
 *   onLayoutChange={setLayout}
 * />
 * ```
 */
export function WindowManager(props: WindowManagerProps): JSX.Element {
  const text = useWindowManagerText();
  let root: HTMLDivElement | undefined;
  const [said, say] = createSignal('');
  const layout = createMemo(() =>
    pruneWindowLayout(
      props.layout,
      props.panels.map((panel) => panel.id)
    )
  );
  const frames = createMemo(() =>
    windowFrames(
      props.compact === true
        ? { ...layout(), maximized: layout().focused }
        : layout()
    )
  );
  const api = createWindowManagerApi(
    props,
    { root: () => root, frames, layout },
    say
  );
  const frameOf = (id: string) =>
    frames().windows.find((frame) => frame.id === id);
  const separatorKeys = createMemo(() =>
    frames().separators.map((item) => `${item.split}:${String(item.index)}`)
  );
  const open = createMemo(() =>
    props.panels
      .map((panel) => panel.id)
      .filter((id) => windowOfPanel(layout(), id) !== null)
  );
  return (
    <WindowManagerContext.Provider value={api}>
      <div
        ref={(element) => {
          root = element;
        }}
        class="box relative flex-1 min-w-0 min-h-0 overflow-hidden bg-surface-muted"
        role="group"
        aria-label={props['aria-label']}
        {...componentDataAttrs('WindowManager', {
          'window-part': 'manager',
          layout: serializeWindowLayout(layout()),
          'focused-window': layout().focused ?? '',
          ...props.dataSet,
        })}
        {...dataAttrs({ dragging: String(api.drag.state() !== null) })}
      >
        <VisuallyHidden id={api.hintId}>{text.hint()}</VisuallyHidden>
        <For each={frames().windows.map((frame) => frame.id)}>
          {(id, index) => (
            <WindowManagerWindow
              windowId={id}
              position={index() + 1}
              count={frames().windows.length}
              rect={
                frameOf(id)?.rect ?? { left: 0, top: 0, width: 0, height: 0 }
              }
            />
          )}
        </For>
        <For each={separatorKeys()}>
          {(_, index) => {
            const frame = () => frames().separators[index()];
            return (
              <Show when={frame()}>
                {(item) => <WindowManagerSeparator frame={item()} />}
              </Show>
            );
          }}
        </For>
        <For each={open()}>
          {(id) => (
            <WindowManagerPanelHost panelId={id} frames={frames().windows} />
          )}
        </For>
        <WindowManagerEmpty when={frames().windows.length === 0} />
        <WindowManagerDropPreview />
        <VisuallyHidden role="status" aria-live="polite">
          {said()}
        </VisuallyHidden>
      </div>
    </WindowManagerContext.Provider>
  );
}
