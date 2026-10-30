/** @jsxImportSource solid-js */
/**
 * Single folder-shaped tab cell for `TabStrip`.
 *
 * Layout is identical for active / inactive: same border box, height, padding,
 * and reserved separator / close slots. Visual differences are color / weight /
 * an out-of-flow hairline cover only. The tab and its close control are sibling
 * `<button>`s inside one chrome shell (buttons cannot nest in HTML).
 */

import { useLingui } from '@lingui/solid/macro';
import { XIcon } from '@pkgs/ui-root-client-ts/icons';
import { type JSX, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import styles from '../tab-strip/tab-strip.module.css';
import type { TabStripItem } from '../tab-strip-types';

export const TAB_MIN_HEIGHT = 32;
export const TAB_MIN_WIDTH = 80;
export const TAB_MAX_WIDTH = 220;

export type TabStripTabProps = {
  readonly item: TabStripItem;
  readonly active: boolean;
  /** When true, keep a fixed separator gutter (opacity follows `separatorVisible`). */
  readonly reserveSeparatorBefore: boolean;
  readonly separatorVisible: boolean;
  readonly onSelect: (id: string) => void;
  readonly ref?: ((el: HTMLElement) => void) | undefined;
  /** DOM id of the tab, for `aria-controls` / `aria-labelledby` wiring. */
  readonly tabId?: string | undefined;
};

function shellClass(active: boolean): string {
  return [
    styles['shell'],
    'box relative shrink-0 flex-row items-center rounded-tl-lg rounded-tr-lg border border-solid border-b-transparent',
    active ? 'border-outline bg-background z-1' : 'border-transparent z-0',
    active ? styles['shellActive'] : '',
  ]
    .filter(Boolean)
    .join(' ');
}

function shellStyle(closable: boolean): JSX.CSSProperties {
  return {
    height: `${TAB_MIN_HEIGHT}px`,
    'min-width': `${TAB_MIN_WIDTH}px`,
    'max-width': `${TAB_MAX_WIDTH}px`,
    'padding-right': closable ? '2px' : '0',
  };
}

export function TabStripTab(props: TabStripTabProps): JSX.Element {
  const { t } = useLingui();
  const closable = (): boolean => props.item.onClose !== undefined;
  const labelClass = (): string =>
    props.active
      ? 'text textLabel line-clamp-1 shrink text-text pointer-events-none'
      : 'text textBody line-clamp-1 shrink text-text-secondary pointer-events-none';
  return (
    <div
      class="box flex-row items-center shrink-0"
      data-component="TabStripCell"
      data-id={props.item.id}
      style={{ height: `${TAB_MIN_HEIGHT}px` }}
      ref={props.ref}
    >
      <Show when={props.reserveSeparatorBefore}>
        <div
          class="box w-px h-4 mx-1 shrink-0 bg-border"
          style={{ opacity: props.separatorVisible ? 1 : 0 }}
          aria-hidden="true"
        />
      </Show>
      <div class={shellClass(props.active)} style={shellStyle(closable())}>
        <button
          class="clickable flex-1 min-w-0 flex-row items-center gap-2 pl-3 rounded-tl-lg rounded-tr-lg overflow-hidden bg-transparent"
          classList={{ clickableTint: !props.active }}
          data-component="TabStripTab"
          data-id={props.item.id}
          type="button"
          style={{
            height: `${TAB_MIN_HEIGHT - 2}px`,
            'padding-right': `${closable() ? 2 : 10}px`,
          }}
          id={props.tabId}
          role="tab"
          aria-selected={props.active}
          aria-keyshortcuts={closable() ? 'Delete' : undefined}
          tabIndex={props.active ? 0 : -1}
          onClick={() => props.onSelect(props.item.id)}
        >
          <Show when={props.item.icon}>
            {(icon) => (
              <Dynamic
                component={icon()}
                size={15}
                color={props.active ? 'tabIconSelected' : 'tabIconDefault'}
              />
            )}
          </Show>
          <span class={labelClass()}>{props.item.label}</span>
        </button>
        <Show when={closable()}>
          <button
            class={`clickable clickableTint rounded-sm items-center justify-center shrink-0 w-6 h-6 ${styles['close'] ?? ''}`}
            data-component="TabStripClose"
            data-id={props.item.id}
            type="button"
            aria-label={t`Close`}
            aria-describedby={props.tabId}
            tabIndex={-1}
            onClick={() => props.item.onClose?.()}
          >
            <XIcon size={12} color="textSecondary" />
          </button>
        </Show>
        <Show when={props.active}>
          <div
            class="box absolute left-px right-px -bottom-px h-1 bg-background z-2 pointer-events-none"
            aria-hidden="true"
          />
        </Show>
      </div>
    </div>
  );
}
