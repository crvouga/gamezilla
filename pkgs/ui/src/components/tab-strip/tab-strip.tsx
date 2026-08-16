/**
 * `TabStrip` -- exclusive floating-pill tab strip for shell / console chrome.
 *
 * Owns a muted strip surface + a constant bottom hairline. Tabs are fully
 * rounded pills with min/max width, clearer padding, and active/inactive
 * contrast. Optional `leading` / `trailing` / `onAdd`. Web keyboard shortcuts
 * when `keyboardScope` is true: mod+1..9, ctrl+tab / ctrl+shift+tab,
 * mod+alt+arrows, mod+w (close), mod+t (add).
 */

import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import type { ComponentDataSet } from '../../component-id';
import { useTheme } from '../../theme';
import { Box } from '../box';
import type { WebKeyboardEventLike } from '../command-palette/keyboard-shortcut';
import { XIcon } from '../icons';
import { Pressable } from '../pressable';
import { ScrollView } from '../scroll-view';
import { Text } from '../text';
import { handleTabStripKeyDown } from './tab-strip-keyboard';
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

const TAB_MIN_HEIGHT = 40;
const TAB_MIN_WIDTH = 88;
const TAB_MAX_WIDTH = 200;

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

function TabPill(props: {
  readonly item: TabStripItem;
  readonly active: boolean;
  readonly onSelect: (id: string) => void;
}) {
  const theme = useTheme();
  const { item, active, onSelect } = props;
  const closable = item.onClose !== undefined;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={() => onSelect(item.id)}
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 1,
        minHeight: TAB_MIN_HEIGHT,
        minWidth: TAB_MIN_WIDTH,
        maxWidth: TAB_MAX_WIDTH,
        paddingLeft: 5,
        paddingRight: closable ? 2 : 5,
        paddingVertical: 2,
        borderRadius: 'md',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: active ? 'border' : 'transparent',
        background: active ? 'background' : 'transparent',
      }}
    >
      <Text
        variant="label"
        label={item.label}
        numberOfLines={1}
        sx={{
          flexShrink: 1,
          color: active ? 'tint' : 'textSecondary',
          fontWeight: active ? '700' : '500',
        }}
      />
      {closable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={item.onClose!}
          sx={{
            padding: 1.5,
            borderRadius: 'sm',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <XIcon size={14} color={theme.colors.textSecondary} />
        </Pressable>
      ) : null}
    </Pressable>
  );
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

  useTabStripKeyboard(keyboardScope, () => ({
    items: props.items,
    selectedId: props.selectedId,
    onSelect: props.onSelect,
    ...(props.onAdd !== undefined ? { onAdd: props.onAdd } : {}),
  }));

  return (
    <Box sx={stripSx} dataSet={{ component: 'TabStrip', ...dataSet }}>
      {leading !== undefined && leading !== null ? (
        <Box sx={leadingSx}>{leading}</Box>
      ) : null}
      <ScrollView
        horizontal
        frameSx={scrollFrameSx}
        sx={pillsSx}
        accessibilityRole="tablist"
        accessibilityLabel={accessibilityLabel}
      >
        {items.map((item) => (
          <TabPill
            key={item.id}
            item={item}
            active={item.id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </ScrollView>
      {trailing !== undefined && trailing !== null ? (
        <Box sx={trailingSx}>{trailing}</Box>
      ) : null}
      {onAdd !== undefined && (trailing === undefined || trailing === null) ? (
        <Pressable
          accessibilityLabel="Add tab"
          onPress={onAdd}
          sx={{
            paddingHorizontal: 4,
            paddingVertical: 2,
            minHeight: TAB_MIN_HEIGHT,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'md',
            overflow: 'hidden',
          }}
        >
          <Text label="+" sx={{ color: 'textSecondary', fontSize: 18 }} />
        </Pressable>
      ) : null}
    </Box>
  );
}

const stripSx = {
  flexGrow: 0,
  flexShrink: 0,
  flexDirection: 'row',
  alignItems: 'center',
  gap: 1.5,
  minHeight: TAB_MIN_HEIGHT + 8,
  paddingLeft: 4,
  paddingRight: 2,
  paddingTop: 2,
  paddingBottom: 2,
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
  paddingLeft: 1,
  paddingRight: 0,
  alignSelf: 'center',
} as const;

const scrollFrameSx = {
  flex: 1,
  minWidth: 0,
  flexGrow: 1,
  flexShrink: 1,
} as const;

const pillsSx = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 1.5,
} as const;
