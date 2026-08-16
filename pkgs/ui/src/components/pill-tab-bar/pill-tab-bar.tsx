/**
 * `PillTabBar` -- compact horizontal exclusive tab strip.
 *
 * Same chrome as the host Main | Console picker: surface bar, hairline bottom
 * border, bordered pills with tint when selected. Horizontal scroll when items
 * overflow. Height stays content-sized (no flex grow).
 *
 * @example
 * ```tsx
 * <PillTabBar
 *   items={[
 *     { id: 'main', label: 'Main' },
 *     { id: 'console', label: 'Console' },
 *   ]}
 *   selectedId={id}
 *   onSelect={setId}
 * />
 * ```
 */

import type { ComponentDataSet } from '../../component-id';
import { Pressable } from '../pressable';
import { ScrollView } from '../scroll-view';
import { Text } from '../text';

export type PillTabItem = {
  readonly id: string;
  readonly label: string;
};

export type PillTabBarProps = {
  readonly items: readonly PillTabItem[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
  /** Accessibility label for the tablist. */
  readonly accessibilityLabel?: string;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  readonly dataSet?: ComponentDataSet;
};

export function PillTabBar(props: PillTabBarProps) {
  const { items, selectedId, onSelect, accessibilityLabel, dataSet } = props;

  return (
    <ScrollView
      horizontal
      frameSx={barFrameSx}
      sx={barContentSx}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      dataSet={{ component: 'PillTabBar', ...dataSet }}
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
  );
}

/** Content-sized bar — never flex-grow into leftover viewport height. */
const barFrameSx = {
  flexGrow: 0,
  flexShrink: 0,
  borderBottomWidth: 1,
  borderColor: 'border',
  background: 'surface',
} as const;

const barContentSx = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 1,
  paddingHorizontal: 2,
  paddingVertical: 2,
} as const;
