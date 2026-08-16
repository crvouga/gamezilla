/**
 * `TabStrip` -- full-width exclusive tab strip for shell / console chrome.
 *
 * Owns surface background + a single hairline bottom border. Call sites must
 * not wrap this in another bordered header. Optional `leading` (e.g. a panel
 * title) sits in the same strip row so title + pills share one border.
 *
 * @example
 * ```tsx
 * <TabStrip
 *   items={[
 *     { id: 'main', label: 'Main' },
 *     { id: 'console', label: 'Console' },
 *   ]}
 *   selectedId={id}
 *   onSelect={setId}
 * />
 * ```
 */

import type { ReactNode } from 'react';
import type { ComponentDataSet } from '../../component-id';
import { Box } from '../box';
import { Pressable } from '../pressable';
import { ScrollView } from '../scroll-view';
import { Text } from '../text';

export type TabStripItem = {
  readonly id: string;
  readonly label: string;
};

export type TabStripProps = {
  readonly items: readonly TabStripItem[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
  /** Optional content left of the pills (e.g. panel title) in the same strip. */
  readonly leading?: ReactNode;
  /** Accessibility label for the tablist. */
  readonly accessibilityLabel?: string;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  readonly dataSet?: ComponentDataSet;
};

export function TabStrip(props: TabStripProps) {
  const { items, selectedId, onSelect, leading, accessibilityLabel, dataSet } =
    props;

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
        {items.map((item) => {
          const active = item.id === selectedId;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => onSelect(item.id)}
              sx={{
                paddingHorizontal: 3,
                paddingVertical: 2,
                borderRadius: 'md',
                borderWidth: 1,
                borderColor: active ? 'tint' : 'border',
                background: active ? 'tintSubtle' : 'surface',
              }}
            >
              <Text
                variant="label"
                label={item.label}
                sx={{ color: active ? 'tint' : 'text' }}
              />
            </Pressable>
          );
        })}
      </ScrollView>
    </Box>
  );
}

/** Content-sized strip — never flex-grow into leftover viewport height. */
const stripSx = {
  flexGrow: 0,
  flexShrink: 0,
  flexDirection: 'row',
  alignItems: 'center',
  gap: 2,
  paddingHorizontal: 2,
  paddingVertical: 2,
  borderBottomWidth: 1,
  borderColor: 'border',
  background: 'surface',
} as const;

const leadingSx = {
  flexShrink: 0,
  paddingHorizontal: 2,
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
  gap: 1,
} as const;
