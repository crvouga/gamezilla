/**
 * `TabStrip` -- browser / IDE folder-tab chrome for shell and console.
 *
 * Muted strip + bottom hairline. Active tab merges into content (top radii,
 * side borders, covers hairline). Inactive tabs are flat with hairline
 * separators and hover. Closable tabs reveal close on hover (always on
 * active). Optional `leading` / `trailing` / `onAdd`. Web keyboard shortcuts
 * when `keyboardScope` is true: mod+1..9, ctrl+tab / ctrl+shift+tab,
 * mod+alt+arrows, mod+w (close), mod+t (add).
 */

import type { ReactNode, RefObject } from 'react';
import { useEffect, useRef } from 'react';
import {
  type LayoutChangeEvent,
  Platform,
  type ScrollView as RNScrollView,
} from 'react-native';

import type { ComponentDataSet } from '../../component-id';
import { useTheme } from '../../theme';
import { Box } from '../box';
import type { WebKeyboardEventLike } from '../command-palette/keyboard-shortcut';
import { PlusIcon } from '../icons';
import { Pressable } from '../pressable';
import { ScrollView } from '../scroll-view';
import { handleTabStripKeyDown } from './tab-strip-keyboard';
import { TAB_MIN_HEIGHT, TabStripTab } from './tab-strip-tab';
import type { TabStripItem } from './tab-strip-types';

export type { TabStripItem } from './tab-strip-types';

export type TabStripProps = {
  readonly items: readonly TabStripItem[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
  readonly leading?: ReactNode;
  readonly trailing?: ReactNode;
  readonly onAdd?: () => void;
  /**
   * Listen for browser tab shortcuts on `document` (web only).
   * Default false — enable on at most one active strip to avoid conflicts.
   */
  readonly keyboardScope?: boolean;
  readonly accessibilityLabel?: string;
  readonly dataSet?: ComponentDataSet;
};

function useTabStripKeyboard(
  enabled: boolean,
  getProps: () => {
    items: readonly TabStripItem[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    onAdd?: () => void;
  }
): void {
  const getPropsRef = useRef(getProps);
  getPropsRef.current = getProps;
  useEffect(() => {
    if (!enabled || Platform.OS !== 'web') return;
    if (typeof document === 'undefined') return;
    const onKeyDown = (raw: KeyboardEvent) => {
      const p = getPropsRef.current();
      const handled = handleTabStripKeyDown(
        raw as unknown as WebKeyboardEventLike,
        {
          items: p.items,
          selectedId: p.selectedId,
          onSelect: p.onSelect,
          ...(p.onAdd !== undefined ? { onAdd: p.onAdd } : {}),
        }
      );
      if (handled) {
        raw.preventDefault();
        raw.stopPropagation();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [enabled]);
}

type TabLayoutMap = Map<string, { x: number; width: number }>;

type ScrollIntoViewRefs = {
  readonly scrollRef: RefObject<RNScrollView | null>;
  readonly layoutsRef: RefObject<TabLayoutMap>;
  readonly viewportWidthRef: RefObject<number>;
  readonly scrollXRef: RefObject<number>;
};

function useScrollSelectedIntoView(
  selectedId: string | null,
  refs: ScrollIntoViewRefs
): void {
  const { scrollRef, layoutsRef, viewportWidthRef, scrollXRef } = refs;
  useEffect(() => {
    if (selectedId === null) return;
    const layout = layoutsRef.current.get(selectedId);
    const viewW = viewportWidthRef.current;
    if (layout === undefined || viewW <= 0) return;
    const pad = 8;
    const scrollX = scrollXRef.current;
    const left = layout.x;
    const right = layout.x + layout.width;
    if (left < scrollX + pad) {
      scrollRef.current?.scrollTo({
        x: Math.max(0, left - pad),
        animated: true,
      });
      return;
    }
    if (right > scrollX + viewW - pad) {
      scrollRef.current?.scrollTo({
        x: Math.max(0, right - viewW + pad),
        animated: true,
      });
    }
  }, [selectedId, scrollRef, layoutsRef, viewportWidthRef, scrollXRef]);
}

export function TabStrip(props: TabStripProps) {
  const {
    items,
    selectedId,
    onSelect,
    leading,
    trailing,
    onAdd,
    keyboardScope = false,
    accessibilityLabel,
    dataSet,
  } = props;
  const theme = useTheme();
  const scrollRef = useRef<RNScrollView>(null);
  const layoutsRef = useRef(new Map<string, { x: number; width: number }>());
  const viewportWidthRef = useRef(0);
  const scrollXRef = useRef(0);

  useTabStripKeyboard(keyboardScope, () => ({
    items: props.items,
    selectedId: props.selectedId,
    onSelect: props.onSelect,
    ...(props.onAdd !== undefined ? { onAdd: props.onAdd } : {}),
  }));
  useScrollSelectedIntoView(selectedId, {
    scrollRef,
    layoutsRef,
    viewportWidthRef,
    scrollXRef,
  });

  const showStandaloneAdd =
    onAdd !== undefined && (trailing === undefined || trailing === null);

  return (
    <Box sx={stripSx} dataSet={{ component: 'TabStrip', ...dataSet }}>
      {leading !== undefined && leading !== null ? (
        <Box sx={leadingSx}>{leading}</Box>
      ) : null}
      <TabStripScroll
        scrollRef={scrollRef}
        items={items}
        selectedId={selectedId}
        onSelect={onSelect}
        {...(accessibilityLabel !== undefined ? { accessibilityLabel } : {})}
        layoutsRef={layoutsRef}
        viewportWidthRef={viewportWidthRef}
        scrollXRef={scrollXRef}
      />
      {trailing !== undefined && trailing !== null ? (
        <Box sx={trailingSx}>{trailing}</Box>
      ) : null}
      {showStandaloneAdd ? (
        <Pressable accessibilityLabel="Add tab" onPress={onAdd} sx={addSx}>
          <PlusIcon size={16} color={theme.colors.textSecondary} />
        </Pressable>
      ) : null}
    </Box>
  );
}

function TabStripScroll(props: {
  readonly scrollRef: RefObject<RNScrollView | null>;
  readonly items: readonly TabStripItem[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
  readonly accessibilityLabel?: string;
  readonly layoutsRef: RefObject<TabLayoutMap>;
  readonly viewportWidthRef: RefObject<number>;
  readonly scrollXRef: RefObject<number>;
}) {
  const {
    scrollRef,
    items,
    selectedId,
    onSelect,
    accessibilityLabel,
    layoutsRef,
    viewportWidthRef,
    scrollXRef,
  } = props;
  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      frameSx={scrollFrameSx}
      sx={tabsSx}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      onLayout={(e: LayoutChangeEvent) => {
        viewportWidthRef.current = e.nativeEvent.layout.width;
      }}
      onScroll={(e) => {
        scrollXRef.current = e.nativeEvent.contentOffset.x;
      }}
      scrollEventThrottle={16}
    >
      {items.map((item, index) => {
        const active = item.id === selectedId;
        const prevId = index > 0 ? items[index - 1]?.id : undefined;
        const prevActive = prevId !== undefined && prevId === selectedId;
        const separatorVisible = index > 0 && !active && !prevActive;
        return (
          <TabStripTab
            key={item.id}
            item={item}
            active={active}
            reserveSeparatorBefore={index > 0}
            separatorVisible={separatorVisible}
            onSelect={onSelect}
            onLayout={(id, x, width) => {
              layoutsRef.current.set(id, { x, width });
            }}
          />
        );
      })}
    </ScrollView>
  );
}

const stripSx = {
  flexGrow: 0,
  flexShrink: 0,
  flexDirection: 'row',
  alignItems: 'center',
  gap: 2,
  minHeight: TAB_MIN_HEIGHT + 4,
  paddingLeft: 4,
  paddingRight: 3,
  paddingTop: 2,
  paddingBottom: 0,
  borderBottomWidth: 1,
  borderColor: 'border',
  background: 'surfaceMuted',
} as const;

const leadingSx = {
  flexShrink: 0,
  paddingHorizontal: 2,
  alignSelf: 'center',
} as const;

const trailingSx = {
  flexShrink: 0,
  paddingLeft: 2,
  paddingRight: 2,
  alignSelf: 'center',
} as const;

const scrollFrameSx = {
  flex: 1,
  minWidth: 0,
  flexGrow: 1,
  flexShrink: 1,
} as const;

const tabsSx = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 1.5,
} as const;

const addSx = {
  paddingHorizontal: 4,
  paddingVertical: 1,
  height: TAB_MIN_HEIGHT,
  alignItems: 'center',
  justifyContent: 'center',
  borderTopLeftRadius: 'md',
  borderTopRightRadius: 'md',
  overflow: 'hidden',
  alignSelf: 'center',
} as const;
