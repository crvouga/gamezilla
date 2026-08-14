import { Pressable, ScrollView, Text } from '@pkgs/ui';

import type { FlatFrame } from './frames';
import { formatMs } from './frames';
import { t } from './tokens';

export function Timeline(props: {
  readonly frames: readonly FlatFrame[];
  readonly selectedIndex: number;
  readonly onSelect: (index: number) => void;
}) {
  if (props.frames.length === 0) {
    return (
      <Text sx={{ ...railSx, color: t.muted, padding: 10 }}>No frames.</Text>
    );
  }

  return (
    <ScrollView
      horizontal
      frameSx={railSx}
      sx={{ flexDirection: 'row', gap: 6, alignItems: 'stretch' }}
      accessibilityLabel="Frames"
    >
      {props.frames.map((frame, index) => {
        const selected = index === props.selectedIndex;
        return (
          <Pressable
            key={`${frame.file}-${index}`}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            sx={[tickSx, selected ? tickActiveSx : null]}
            onPress={() => props.onSelect(index)}
          >
            <Text sx={{ fontWeight: '600', color: t.text, fontSize: 12 }}>
              {index + 1}
            </Text>
            <Text sx={{ color: t.muted, fontSize: 11 }}>{frame.step.kind}</Text>
            <Text sx={{ color: t.muted, fontSize: 11 }}>
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
  backgroundColor: t.panel,
  minHeight: 52,
} as const;

const tickSx = {
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 2,
  minWidth: 72,
  paddingVertical: 6,
  paddingHorizontal: 8,
  backgroundColor: t.bg,
  borderWidth: 1,
  borderColor: t.border,
  borderRadius: 4,
} as const;

const tickActiveSx = { borderColor: t.accent } as const;
