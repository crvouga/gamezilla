/** @jsxImportSource solid-js */
/**
 * Single folder-shaped tab cell for `TabStrip`.
 *
 * Layout is identical for active / inactive: same border box, height, padding,
 * font weight, and reserved separator / close slots. Visual differences are
 * color / opacity / an out-of-flow hairline cover only. The tab and its close
 * control are sibling `<button>`s inside one chrome shell (buttons cannot
 * nest in HTML).
 */

import { useLingui } from '@lingui/solid/macro';
import { type JSX, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { Box, joinClass } from '../box';
import { Clickable } from '../clickable';
import { XIcon } from '../icons';
import { Text } from '../text';
import type { TabStripItem } from './tab-strip-types';

export const TAB_MIN_HEIGHT = 32;
export const TAB_MIN_WIDTH = 88;
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

function shellChromeClass(active: boolean): string {
  return joinClass(
    'relative shrink-0 flex-row items-center rounded-tl-[10px] rounded-tr-[10px] border border-solid border-b-transparent',
    active ? 'border-border bg-background z-[1]' : 'border-transparent z-0'
  );
}

function shellChromeStyle(closable: boolean): JSX.CSSProperties {
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
  const fgClass = (): string =>
    props.active ? 'text-text' : 'text-text-secondary';
  return (
    <Box
      class="flex-row items-center shrink-0"
      dataSet={{ component: 'TabStripCell', id: props.item.id }}
      style={{ height: `${TAB_MIN_HEIGHT}px` }}
      ref={props.ref}
    >
      <Show when={props.reserveSeparatorBefore}>
        <Box
          class="w-px h-[14px] mx-0.5 shrink-0 bg-border"
          style={{ opacity: props.separatorVisible ? 1 : 0 }}
          aria-hidden="true"
        />
      </Show>
      <Box
        class={shellChromeClass(props.active)}
        style={shellChromeStyle(closable())}
      >
        <Clickable
          feedback={props.active ? 'none' : 'tint'}
          class="flex-1 min-w-0 flex-row items-center gap-1.5 pl-[5px] rounded-tl-[10px] rounded-tr-[10px] overflow-hidden bg-transparent"
          style={{
            height: `${TAB_MIN_HEIGHT - 2}px`,
            'padding-right': `${closable() ? 2 : 5}px`,
          }}
          dataSet={{ component: 'TabStripTab', id: props.item.id }}
          id={props.tabId}
          role="tab"
          aria-selected={props.active}
          tabIndex={props.active ? 0 : -1}
          onClick={() => props.onSelect(props.item.id)}
        >
          <Show when={props.item.icon}>
            {(icon) => (
              <Box class="w-[14px] h-[14px] items-center justify-center shrink-0">
                <Dynamic
                  component={icon()}
                  size={14}
                  color={props.active ? 'tint' : 'textSecondary'}
                />
              </Box>
            )}
          </Show>
          <Text
            variant="label"
            class={joinClass('shrink font-semibold leading-[18px]', fgClass())}
            numberOfLines={1}
            label={props.item.label}
          />
        </Clickable>
        <Show when={closable()}>
          <Clickable
            class="rounded-[6px] items-center justify-center shrink-0 w-[22px] h-[22px]"
            dataSet={{ component: 'TabStripClose', id: props.item.id }}
            aria-label={t`Close`}
            tabIndex={-1}
            onClick={() => props.item.onClose?.()}
          >
            <XIcon size={12} color="textSecondary" />
          </Clickable>
        </Show>
        <Show when={props.active}>
          <Box
            class="absolute left-px right-px -bottom-px h-0.5 bg-background z-[2] pointer-events-none"
            aria-hidden="true"
          />
        </Show>
      </Box>
    </Box>
  );
}
