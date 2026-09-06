/** @jsxImportSource solid-js */
/**
 * `TabStrip` -- browser / IDE folder-tab chrome for shell and console.
 *
 * Muted strip + bottom hairline. Active tab merges into content (top radii,
 * side borders, covers hairline). Inactive tabs are flat with hairline
 * separators and hover. Closable tabs reveal close on hover (always on
 * active). Optional `leading` / `trailing` / `onAdd`. Keyboard shortcuts
 * when `keyboardScope` is true: mod+1..9, ctrl+tab / ctrl+shift+tab,
 * mod+alt+arrows, mod+w (close), mod+t (add). Arrow keys move selection
 * while focus is inside the `tablist`.
 */

import { useLingui } from '@lingui/solid/macro';
import {
  createEffect,
  createUniqueId,
  Index,
  type JSX,
  on,
  Show,
} from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import type { SxProps } from '../../theme';
import { Box } from '../box';
import { Clickable } from '../clickable';
import { PlusIcon } from '../icons';
import { useDocumentShortcuts } from '../keyboard-shortcuts';
import { ScrollView } from '../scroll-view';
import { handleTabStripKeyDown } from './tab-strip-keyboard';
import { TAB_MIN_HEIGHT, TabStripTab } from './tab-strip-tab';
import type { TabStripItem } from './tab-strip-types';

export type TabStripProps = {
  readonly items: readonly TabStripItem[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
  readonly leading?: JSX.Element | undefined;
  readonly trailing?: JSX.Element | undefined;
  readonly onAdd?: (() => void) | undefined;
  /**
   * Listen for browser tab shortcuts on `document`.
   * Default false — enable on at most one active strip to avoid conflicts.
   */
  readonly keyboardScope?: boolean | undefined;
  readonly 'aria-label'?: string | undefined;
  readonly dataSet?: ComponentDataSet | undefined;
};

const stripSx: SxProps = {
  flexGrow: 0,
  flexShrink: 0,
  flexDirection: 'row',
  alignItems: 'center',
  gap: 2,
  minHeight: TAB_MIN_HEIGHT + 4,
  paddingLeft: 4,
  paddingRight: 4,
  paddingTop: 2,
  paddingBottom: 0,
  borderBottomWidth: 1,
  borderColor: 'border',
  backgroundColor: 'surfaceMuted',
};

const leadingSx: SxProps = {
  flexShrink: 0,
  paddingHorizontal: 2,
  alignSelf: 'center',
};

/** Stretch to the full strip (cancel top pad) so trailing controls sit equal / flush. */
const trailingSx: SxProps = {
  flexShrink: 0,
  alignSelf: 'stretch',
  marginTop: -2,
  justifyContent: 'center',
  paddingLeft: 4,
};

const scrollFrameSx: SxProps = {
  flex: 1,
  minWidth: 0,
  flexGrow: 1,
  flexShrink: 1,
};

const tabsSx: SxProps = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 1.5,
};

const addSx: SxProps = {
  paddingHorizontal: 4,
  paddingVertical: 1,
  height: TAB_MIN_HEIGHT,
  alignItems: 'center',
  justifyContent: 'center',
  borderTopLeftRadius: 'md',
  borderTopRightRadius: 'md',
  overflow: 'hidden',
  alignSelf: 'center',
};

/** Roving arrow-key navigation inside the tablist (WAI-ARIA tabs pattern). */
function tablistArrowKey(
  key: string,
  items: readonly TabStripItem[],
  selectedId: string | null
): string | null {
  if (items.length === 0) return null;
  const delta = key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1 : 0;
  if (delta === 0) {
    if (key === 'Home') return items[0]?.id ?? null;
    if (key === 'End') return items[items.length - 1]?.id ?? null;
    return null;
  }
  const cur = items.findIndex((i) => i.id === selectedId);
  const next = cur < 0 ? 0 : (cur + delta + items.length) % items.length;
  return items[next]?.id ?? null;
}

export function TabStrip(props: TabStripProps): JSX.Element {
  const { t } = useLingui();
  const idBase = `ui-tab-${createUniqueId()}`;
  const tabEls = new Map<string, HTMLElement>();

  useDocumentShortcuts({
    enabled: () => props.keyboardScope === true,
    onKeyDown: (ev) =>
      handleTabStripKeyDown(ev, {
        items: props.items,
        selectedId: props.selectedId,
        onSelect: props.onSelect,
        onAdd: props.onAdd,
      }),
  });

  // Keep the selected tab in view when selection changes.
  createEffect(
    on(
      () => props.selectedId,
      (id) => {
        if (id === null) return;
        const el = tabEls.get(id);
        if (el !== undefined && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
      },
      { defer: true }
    )
  );

  const showStandaloneAdd = (): boolean =>
    props.onAdd !== undefined &&
    (props.trailing === undefined || props.trailing === null);

  return (
    <Box sx={stripSx} dataSet={{ component: 'TabStrip', ...props.dataSet }}>
      <Show when={props.leading !== undefined && props.leading !== null}>
        <Box sx={leadingSx}>{props.leading}</Box>
      </Show>
      <ScrollView
        horizontal
        hideScrollbar
        frameSx={scrollFrameSx}
        sx={tabsSx}
        role="tablist"
        aria-label={props['aria-label']}
        onKeyDown={(ev) => {
          const next = tablistArrowKey(ev.key, props.items, props.selectedId);
          if (next === null) return;
          ev.preventDefault();
          props.onSelect(next);
          tabEls.get(next)?.querySelector<HTMLElement>('[role="tab"]')?.focus();
        }}
      >
        <Index each={props.items}>
          {(item, index) => {
            const active = (): boolean => item().id === props.selectedId;
            const prevActive = (): boolean =>
              index > 0 && props.items[index - 1]?.id === props.selectedId;
            return (
              <TabStripTab
                item={item()}
                active={active()}
                reserveSeparatorBefore={index > 0}
                separatorVisible={index > 0 && !active() && !prevActive()}
                onSelect={props.onSelect}
                tabId={`${idBase}-${item().id}`}
                ref={(el) => tabEls.set(item().id, el)}
              />
            );
          }}
        </Index>
      </ScrollView>
      <Show when={props.trailing !== undefined && props.trailing !== null}>
        <Box sx={trailingSx}>{props.trailing}</Box>
      </Show>
      <Show when={showStandaloneAdd()}>
        <Clickable
          aria-label={t`Add tab`}
          onClick={() => props.onAdd?.()}
          sx={addSx}
          dataSet={{ component: 'TabStripAdd' }}
        >
          <PlusIcon size={16} color="textSecondary" />
        </Clickable>
      </Show>
    </Box>
  );
}
