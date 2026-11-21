/** @jsxImportSource solid-js */
/**
 * What a window manager draws besides its windows: the panels themselves,
 * the preview of a drop, and the empty state.
 */

import { useLingui } from '@lingui/solid/macro';
import { windowOfPanel } from '@pkgs/ui-devtools-shared-ts/window-layout';
import type {
  WindowFrame,
  WindowRect,
} from '@pkgs/ui-devtools-shared-ts/window-layout-geometry';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { componentId, dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { For, type JSX, Show, untrack } from 'solid-js';
import { useWindowManager } from '../window-manager-context';
import { WINDOW_GAP, WINDOW_TAB_BAR_HEIGHT } from '../window-manager-types';

/** Inside a window's border, below its tab bar. */
function panelStyle(rect: WindowRect): JSX.CSSProperties {
  const inset = WINDOW_GAP / 2 + 1;
  return {
    left: `calc(${rect.left * 100}% + ${inset}px)`,
    top: `calc(${rect.top * 100}% + ${inset + WINDOW_TAB_BAR_HEIGHT}px)`,
    width: `calc(${rect.width * 100}% - ${inset * 2}px)`,
    height: `calc(${rect.height * 100}% - ${inset * 2 + WINDOW_TAB_BAR_HEIGHT}px)`,
  };
}

export type WindowManagerPanelHostProps = {
  readonly panelId: string;
  readonly frames: readonly WindowFrame[];
};

/**
 * The element of one open panel. It is positioned over its window and
 * hidden while another tab of that window shows, and never moves in the
 * document.
 */
export function WindowManagerPanelHost(
  props: WindowManagerPanelHostProps
): JSX.Element {
  const api = useWindowManager();
  const group = () => windowOfPanel(api.layout(), props.panelId);
  const rect = (): WindowRect | undefined => {
    const own = group();
    if (own === null || own.active !== props.panelId) return undefined;
    return props.frames.find((frame) => frame.id === own.id)?.rect;
  };
  const focus = (): void => {
    const own = group();
    if (own !== null) api.dispatch({ type: 'focus', window: own.id });
  };
  const content = untrack(() => api.panel(props.panelId)?.content());
  return (
    <div
      class="box absolute z-0 overflow-hidden bg-background rounded-bl-control rounded-br-control"
      classList={{ hidden: rect() === undefined }}
      data-component={componentId('WindowManagerPanel')}
      {...dataAttrs({
        'window-part': 'panel',
        'panel-id': props.panelId,
        'window-id': group()?.id ?? '',
        'panel-visible': String(rect() !== undefined),
      })}
      style={panelStyle(rect() ?? { left: 0, top: 0, width: 0, height: 0 })}
      id={api.panelId(props.panelId)}
      role="tabpanel"
      aria-labelledby={api.tabId(props.panelId)}
      tabIndex={-1}
      onPointerDown={focus}
      onFocusIn={focus}
    >
      {content}
    </div>
  );
}

function rectStyle(rect: WindowRect, strip: boolean): JSX.CSSProperties {
  const half = WINDOW_GAP / 2;
  return {
    left: `calc(${rect.left * 100}% + ${half}px)`,
    top: `calc(${rect.top * 100}% + ${half}px)`,
    width: `calc(${rect.width * 100}% - ${WINDOW_GAP}px)`,
    height: strip
      ? `${WINDOW_TAB_BAR_HEIGHT}px`
      : `calc(${rect.height * 100}% - ${WINDOW_GAP}px)`,
  };
}

/**
 * While a tab is dragged: the area the drop would fill, the marker where
 * the tab would land in a tab bar, and the tab's title under the pointer.
 */
export function WindowManagerDropPreview(): JSX.Element {
  const api = useWindowManager();
  return (
    <Show when={api.drag.state()}>
      {(drag) => (
        <>
          <Show when={drag().target}>
            {(target) => (
              <div
                class="box absolute z-1 pointer-events-none rounded-control border border-solid border-tint bg-tint/15"
                data-component={componentId('WindowManagerDropPreview')}
                {...dataAttrs({
                  'window-part': 'drop-preview',
                  'window-id': target().window,
                  'drop-zone': target().zone,
                })}
                style={rectStyle(target().rect, target().zone === 'tabs')}
                aria-hidden="true"
              />
            )}
          </Show>
          <Show when={drag().target?.zone === 'tabs' && drag().marker !== null}>
            <div
              class="box absolute z-1 pointer-events-none bg-tint rounded-sm"
              {...dataAttrs({ 'window-part': 'drop-marker' })}
              style={{
                left: `${(drag().marker ?? 0) - 1}px`,
                width: '2px',
                top: `calc(${(drag().target?.rect.top ?? 0) * 100}% + ${WINDOW_GAP / 2 + 4}px)`,
                height: `${WINDOW_TAB_BAR_HEIGHT - 6}px`,
              }}
              aria-hidden="true"
            />
          </Show>
          <div
            class="box absolute z-1 pointer-events-none px-3 py-1 rounded-control border border-solid border-border bg-surface"
            {...dataAttrs({ 'window-part': 'drag-ghost' })}
            style={{ left: `${drag().x + 12}px`, top: `${drag().y + 12}px` }}
            aria-hidden="true"
          >
            <span class="text textLabel text-text line-clamp-1">
              {api.panel(drag().panel)?.title}
            </span>
          </div>
        </>
      )}
    </Show>
  );
}

/** Shown when every panel is closed: a way back to each of them. */
export function WindowManagerEmpty(props: {
  readonly when: boolean;
}): JSX.Element {
  const { t } = useLingui();
  const api = useWindowManager();
  return (
    <Show when={props.when}>
      <div
        class="box absolute inset-0 items-center justify-center gap-3 p-6"
        {...dataAttrs({ 'window-part': 'empty' })}
      >
        <span class="text textBody text-text-secondary text-center">
          {t`No panels are open`}
        </span>
        <div class="box flex-row flex-wrap justify-center gap-2">
          <For each={api.closed()}>
            {(panel) => (
              <Button
                title={panel.title}
                variant="outline"
                intent="neutral"
                size="sm"
                dataSet={{ 'window-part': 'open', 'panel-id': panel.id }}
                onClick={() =>
                  api.dispatch(
                    { type: 'open', panel: panel.id },
                    { focus: true }
                  )
                }
              />
            )}
          </For>
        </div>
      </div>
    </Show>
  );
}
