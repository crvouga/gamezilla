/**
 * `SegmentedControl` -- horizontal tab-like mode switcher.
 *
 * A row of pressable segments; exactly one is selected at a time.
 *
 * @example
 * ```tsx
 * <SegmentedControl
 *   segments={[
 *     { key: 'playground', label: 'Playground' },
 *     { key: 'docs', label: 'Docs' },
 *   ]}
 *   selected="playground"
 *   onSelect={setMode}
 * />
 * ```
 */

import { Pressable, View } from 'react-native';
import { useTheme } from '../../theme';
import { Text } from '../text';

export type Segment<K extends string = string> = {
  key: K;
  label: string;
};

export type SegmentedControlProps<K extends string = string> = {
  segments: Segment<K>[];
  selected: K;
  onSelect: (key: K) => void;
  disabled?: boolean;
};

export function SegmentedControl<K extends string = string>({
  segments,
  selected,
  onSelect,
  disabled = false,
}: SegmentedControlProps<K>) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: theme.colors.surface,
        borderRadius: 10,
        padding: 3,
        gap: 2,
      }}
    >
      {segments.map((seg) => {
        const isActive = seg.key === selected;
        return (
          <Pressable
            key={seg.key}
            onPress={() => onSelect(seg.key)}
            disabled={disabled || isActive}
            style={({ pressed }) => [
              {
                flex: 1,
                alignItems: 'center' as const,
                paddingVertical: 8,
                paddingHorizontal: 14,
                borderRadius: 8,
                backgroundColor: isActive ? theme.colors.paper : 'transparent',
              },
              isActive && {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 2,
                elevation: 2,
              },
              pressed && !isActive && { opacity: 0.7 },
            ]}
          >
            <Text
              variant="label"
              style={{
                color: isActive ? theme.colors.text : theme.colors.textSecondary,
                fontWeight: isActive ? '600' : '400',
              }}
              label={seg.label}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
