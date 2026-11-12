/** @jsxImportSource solid-js */
/**
 * The chrome of one window: a frame, a tab bar and the window's controls.
 * The frame floats above the panel it surrounds and lets the pointer
 * through, so the panel's own element never has to live inside it.
 */

import { useLingui } from '@lingui/solid/macro';
import {
  windowById,
  windowGroups,
  windowOfPanel,
  windowPanels,
} from '@pkgs/ui-devtools-shared-ts/window-layout';
import type { WindowRect } from '@pkgs/ui-devtools-shared-ts/window-layout-geometry';
import { IconButton } from '@pkgs/ui-root-client-ts/icon-button';
import {
  EllipsisIcon,
  Maximize2Icon,
  Minimize2Icon,
  PlusIcon,
} from '@pkgs/ui-root-client-ts/icons';
import {
  type OverflowMenuAction,
  OverflowMenuButton,
} from '@pkgs/ui-root-client-ts/overflow-menu-button';
import { ScrollView } from '@pkgs/ui-root-client-ts/scroll-view';
import { componentId, dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { For, type JSX, Show } from 'solid-js';
import styles from '../window-manager/window-manager.module.css';
import { useWindowManager } from '../window-manager-context';
import { useWindowMenuActions } from '../window-manager-menu';
import { WindowManagerTab } from '../window-manager-tab/index';
import { useWindowManagerText } from '../window-manager-text';
import { WINDOW_GAP, WINDOW_TAB_BAR_HEIGHT } from '../window-manager-types';

export type WindowManagerWindowProps = {
  readonly windowId: string;
  /** 1-based place among the visible windows, and how many there are. */
  readonly position: number;
  readonly count: number;
  readonly rect: WindowRect;
};

const CONTROL_SIZE = 26;

/** The window's rectangle, inset by half the gap on every side. */
export function windowFrameStyle(rect: WindowRect): JSX.CSSProperties {
  const half = WINDOW_GAP / 2;
  return {
    left: `calc(${rect.left * 100}% + ${half}px)`,
    top: `calc(${rect.top * 100}% + ${half}px)`,
    width: `calc(${rect.width * 100}% - ${WINDOW_GAP}px)`,
    height: `calc(${rect.height * 100}% - ${WINDOW_GAP}px)`,
  };
}

function WindowControls(props: { readonly windowId: string }): JSX.Element {
  const { t } = useLingui();
  const api = useWindowManager();
  const menu = useWindowMenuActions(() => props.windowId);
  const maximized = (): boolean => api.layout().maximized === props.windowId;
  const reopen = (): OverflowMenuAction[] =>
    api.closed().map((panel) => ({
      id: panel.id,
      label: panel.title,
      icon: panel.icon,
      dataSet: { 'window-part': 'open', 'panel-id': panel.id },
      onClick: () =>
        api.dispatch({ type: 'open', panel: panel.id }, { focus: true }),
    }));
  return (
    <div
      class={`box flex-row items-center shrink-0 self-center gap-1 pr-1 ${styles['controls'] ?? ''}`}
    >
      <Show when={api.closed().length > 0}>
        <OverflowMenuButton
          aria-label={t`Open a panel`}
          icon={PlusIcon}
          size={CONTROL_SIZE}
          actions={reopen()}
          dataSet={{ 'window-part': 'open-menu' }}
        />
      </Show>
      <Show when={!api.compact() && windowGroups(api.layout()).length > 1}>
        <IconButton
          label={maximized() ? t`Restore windows` : t`Maximize window`}
          size={CONTROL_SIZE}
          tooltipFloating
          aria-pressed={maximized()}
          dataSet={{ 'window-part': 'maximize' }}
          onClick={() =>
            api.dispatch(
              maximized()
                ? { type: 'restore' }
                : { type: 'maximize', window: props.windowId }
            )
          }
        >
          <Show when={maximized()} fallback={<Maximize2Icon size={14} />}>
            <Minimize2Icon size={14} />
          </Show>
        </IconButton>
      </Show>
      <Show when={menu().length > 0}>
        <OverflowMenuButton
          aria-label={t`Window actions`}
          icon={EllipsisIcon}
          size={CONTROL_SIZE}
          actions={menu()}
          dataSet={{ 'window-part': 'menu' }}
        />
      </Show>
    </div>
  );
}

/** One window of a `WindowManager`. Renders inside one. */
export function WindowManagerWindow(
  props: WindowManagerWindowProps
): JSX.Element {
  const api = useWindowManager();
  const text = useWindowManagerText();
  const group = () => windowById(api.layout(), props.windowId);
  const focused = (): boolean => api.layout().focused === props.windowId;
  const active = (): string => group()?.active ?? '';
  const tabs = (): readonly string[] =>
    api.compact() ? windowPanels(api.layout()) : (group()?.tabs ?? []);
  const focus = (): void =>
    api.dispatch({ type: 'focus', window: props.windowId });
  const toggleMaximize = (): void => {
    if (api.compact() || windowGroups(api.layout()).length < 2) return;
    api.dispatch(
      api.layout().maximized === null
        ? { type: 'maximize', window: props.windowId }
        : { type: 'restore' }
    );
  };
  return (
    <section
      role="group"
      class={`box absolute z-1 pointer-events-none overflow-hidden rounded-control border border-solid ${styles['window'] ?? ''}`}
      classList={{ 'border-tint': focused(), 'border-border': !focused() }}
      data-component={componentId('WindowManagerWindow')}
      {...dataAttrs({
        'window-part': 'window',
        'window-id': props.windowId,
        'window-focused': String(focused()),
        'window-maximized': String(api.layout().maximized === props.windowId),
        'active-panel': active(),
      })}
      style={windowFrameStyle(props.rect)}
      aria-label={text.windowLabel({
        position: props.position,
        count: props.count,
        title: api.panel(active())?.title ?? '',
      })}
      aria-owns={api.panelId(active())}
    >
      <div
        class="box flex-row items-end gap-1 pl-1 pointer-events-auto border-b border-border bg-surface-muted"
        {...dataAttrs({
          'window-part': 'tab-bar',
          'window-id': props.windowId,
        })}
        style={{ height: `${WINDOW_TAB_BAR_HEIGHT}px` }}
        onPointerDown={focus}
        onFocusIn={focus}
        onDblClick={toggleMaximize}
      >
        <div
          class="sr-only"
          role="tablist"
          aria-label={text.tabsLabel(props.position)}
          aria-owns={tabs().map(api.tabId).join(' ')}
        />
        <ScrollView
          horizontal
          hideScrollbar
          grow
          self="stretch"
          fill
          align="end"
          gap="xs"
          tabIndex={-1}
        >
          <For each={tabs()}>
            {(id) => (
              <Show when={api.panel(id)}>
                {(panel) => (
                  <WindowManagerTab
                    panel={panel()}
                    windowId={
                      windowOfPanel(api.layout(), id)?.id ?? props.windowId
                    }
                    active={id === active()}
                    focused={focused()}
                  />
                )}
              </Show>
            )}
          </For>
        </ScrollView>
        <WindowControls windowId={props.windowId} />
      </div>
    </section>
  );
}
