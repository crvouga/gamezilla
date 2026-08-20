import { Pressable, ScrollView, Text } from '@pkgs/ui';

import type { FlatFrame } from './frames';
import { formatMs } from './frames';

export function Timeline(props: {
  readonly frames: readonly FlatFrame[];
  readonly selectedIndex: number;
  readonly onSelect: (index: number) => void;
}) {
  if (props.frames.length === 0) {
    return (
      <Text sx={{ ...railSx, color: 'textSecondary', padding: 10 }}>
        No frames.
      </Text>
    );
  }

  return (
    <ScrollView
      horizontal
      frameSx={railSx}
      sx={{ flexDirection: 'row', gap: 1.5, alignItems: 'stretch' }}
      accessibilityLabel="Frames"
    >
      {props.frames.map((frame, index) => {
        const selected = index === props.selectedIndex;
        return (
          <Pressable
            key={`${frame.file}-${index}`}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            sx={{
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 0.5,
              minWidth: 72,
              paddingVertical: 6,
              paddingHorizontal: 8,
              background: 'background',
              borderWidth: 1,
              borderColor: selected ? 'tint' : 'border',
              borderRadius: 'md',
            }}
            onPress={() => props.onSelect(index)}
          >
            <Text sx={{ fontWeight: '600', color: 'text', fontSize: 12 }}>
              {index + 1}
            </Text>
            <Text sx={{ color: 'textSecondary', fontSize: 11 }}>
              {frame.step.title}
            </Text>
            <Text sx={{ color: 'textSecondary', fontSize: 11 }}>
              {formatMs(frame.durationMs)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const railSx = {
  paddingTop: 6,
  paddingBottom: 10,
  background: 'surface',
  minHeight: 52,
  flexGrow: 0,
} as const;
