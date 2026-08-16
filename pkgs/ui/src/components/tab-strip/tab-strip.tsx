/**
 * `TabStrip` -- browser-like exclusive tab strip for shell / console chrome.
 *
 * Owns surface background + a hairline bottom border. Tabs are squarer and
 * taller than pills; the active tab sits flush with the content edge.
 * Optional `leading` / `trailing` / `onAdd`. Web keyboard shortcuts when
 * `keyboardScope` is true: mod+1..9, ctrl+tab / ctrl+shift+tab,
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
        minHeight: 36,
        minWidth: 96,
        paddingLeft: 3,
        paddingRight: closable ? 1 : 3,
        paddingVertical: 2,
        borderTopLeftRadius: 'sm',
        borderTopRightRadius: 'sm',
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        borderWidth: 1,
        borderBottomWidth: active ? 0 : 1,
        marginBottom: active ? -1 : 0,
        borderColor: active ? 'border' : 'transparent',
        background: active ? 'background' : 'transparent',
      }}
    >
      <Text
        variant="label"
        label={item.label}
        sx={{
          color: active ? 'text' : 'textSecondary',
          fontWeight: active ? '600' : '500',
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
            paddingHorizontal: 3,
            paddingVertical: 2,
            minHeight: 36,
            alignItems: 'center',
            justifyContent: 'center',
            borderTopLeftRadius: 'sm',
            borderTopRightRadius: 'sm',
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
  alignItems: 'flex-end',
  gap: 1,
  paddingHorizontal: 2,
  paddingTop: 2,
  borderBottomWidth: 1,
  borderColor: 'border',
  background: 'surface',
} as const;

const leadingSx = {
  flexShrink: 0,
  paddingHorizontal: 2,
  paddingBottom: 2,
  alignSelf: 'center',
} as const;

const trailingSx = {
  flexShrink: 0,
  paddingHorizontal: 1,
  paddingBottom: 1,
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
  alignItems: 'flex-end',
  gap: 0,
} as const;
