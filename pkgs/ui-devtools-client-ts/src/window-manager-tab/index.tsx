/** @jsxImportSource solid-js */
/**
 * One tab of a window: selects its panel on click, drags to another window,
 * and answers the layout keys. The tab and its close control are sibling
 * buttons in one shell, as in `TabStrip`.
 */

import { useLingui } from '@lingui/solid/macro';
import { windowPanels } from '@pkgs/ui-devtools-shared-ts/window-layout';
import {
  WINDOW_TAB_KEYSHORTCUTS,
  windowFlatTabKeyCommand,
  windowTabKeyCommand,
} from '@pkgs/ui-devtools-shared-ts/window-layout-keyboard';
import { XIcon } from '@pkgs/ui-root-client-ts/icons';
import { componentId, dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { createEffect, type JSX, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import styles from '../tab-strip/tab-strip.module.css';
import {
  useWindowManager,
  type WindowManagerApi,
} from '../window-manager-context';
import type { WindowPanel } from '../window-manager-types';

export const WINDOW_TAB_HEIGHT = 30;

export type WindowManagerTabProps = {
  readonly panel: WindowPanel;
  readonly windowId: string;
  /** The panel is the one its window shows. */
  readonly active: boolean;
  /** The window is the focused one. */
  readonly focused: boolean;
};

function shellClass(active: boolean): string {
  return [
    styles['shell'],
    'box relative shrink-0 flex-row items-center rounded-tl-lg rounded-tr-lg border border-solid border-b-transparent select-none',
    active ? 'border-outline bg-background z-1' : 'border-transparent z-0',
    active ? styles['shellActive'] : '',
  ]
    .filter(Boolean)
    .join(' ');
}

function onTabKeyDown(
  event: KeyboardEvent,
  api: WindowManagerApi,
  panel: WindowPanel
): void {
  if (event.key === 'Escape' && api.drag.state() !== null) {
    api.drag.cancel();
    return;
  }
  const layout = api.layout();
  let command = api.compact()
    ? windowFlatTabKeyCommand(windowPanels(layout), panel.id, event)
    : windowTabKeyCommand(layout, panel.id, event);
  if (event.key === 'Delete' && panel.closable !== false)
    command = { type: 'close', panel: panel.id };
  if (command !== null) {
    event.preventDefault();
    api.dispatch(command, { focus: true });
    return;
  }
  if (event.key !== 'ArrowDown' || event.altKey) return;
  event.preventDefault();
  api.focusPanel(panel.id);
}

/** A crowded tab bar scrolls; the tab it shows must not be scrolled away. */
function createKeepInView(
  active: () => boolean
): (element: HTMLElement) => void {
  let shell: HTMLElement | undefined;
  createEffect(() => {
    if (active())
      shell?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });
  return (element) => {
    shell = element;
  };
}

/** A tab in a window's tab bar. Renders inside a `WindowManager`. */
export function WindowManagerTab(props: WindowManagerTabProps): JSX.Element {
  const { t } = useLingui();
  const api = useWindowManager();
  const closable = (): boolean => props.panel.closable !== false;
  const dragging = (): boolean => api.drag.state()?.panel === props.panel.id;
  const title = (): string => props.panel.title;
  const setShell = createKeepInView(() => props.active);
  return (
    <div
      ref={setShell}
      class={shellClass(props.active)}
      classList={{ 'touch-none': !api.compact() }}
      data-component={componentId('WindowManagerTabShell')}
      style={{
        height: `${WINDOW_TAB_HEIGHT}px`,
        'max-width': '200px',
        'padding-right': closable() ? '2px' : '0',
        opacity: dragging() ? 0.4 : 1,
      }}
      onPointerDown={(event) => api.drag.down(props.panel.id, event)}
    >
      <Show when={props.active && props.focused}>
        <div
          class="box absolute left-0 right-0 top-0 bg-tint rounded-tl-lg rounded-tr-lg pointer-events-none"
          style={{ height: '2px' }}
          aria-hidden="true"
        />
      </Show>
      <button
        ref={(element) => api.registerTab(props.panel.id, element)}
        class="clickable flex-1 min-w-0 flex-row items-center gap-2 pl-3 rounded-tl-lg rounded-tr-lg overflow-hidden bg-transparent"
        classList={{ clickableTint: !props.active }}
        data-component={componentId('WindowManagerTab')}
        {...dataAttrs({
          'window-part': 'tab',
          'panel-id': props.panel.id,
          'window-id': props.windowId,
        })}
        type="button"
        style={{
          height: `${WINDOW_TAB_HEIGHT - 2}px`,
          'padding-right': `${closable() ? 2 : 10}px`,
        }}
        id={api.tabId(props.panel.id)}
        role="tab"
        aria-selected={props.active}
        aria-controls={api.panelId(props.panel.id)}
        aria-describedby={api.hintId}
        aria-keyshortcuts={WINDOW_TAB_KEYSHORTCUTS}
        tabIndex={props.active ? 0 : -1}
        onClick={() => {
          if (api.drag.consumeClick()) return;
          api.dispatch({ type: 'select', panel: props.panel.id });
        }}
        onKeyDown={(event) => onTabKeyDown(event, api, props.panel)}
      >
        <Show when={props.panel.icon}>
          {(icon) => (
            <Dynamic
              component={icon()}
              size={14}
              color={props.active ? 'tabIconSelected' : 'tabIconDefault'}
            />
          )}
        </Show>
        <span
          class="text line-clamp-1 shrink pointer-events-none"
          classList={{
            'textLabel text-text': props.active,
            'textBody text-text-secondary': !props.active,
          }}
        >
          {title()}
        </span>
      </button>
      <Show when={closable()}>
        <button
          class={`clickable clickableTint rounded-sm items-center justify-center shrink-0 w-6 h-6 ${styles['close'] ?? ''}`}
          data-component={componentId('WindowManagerTabClose')}
          {...dataAttrs({ 'window-part': 'close', 'panel-id': props.panel.id })}
          type="button"
          aria-label={t`Close ${title()}`}
          tabIndex={-1}
          onClick={() => api.dispatch({ type: 'close', panel: props.panel.id })}
        >
          <XIcon size={12} color="textSecondary" />
        </button>
      </Show>
    </div>
  );
}
