import { Box, Pressable, ScrollView, Text } from '@pkgs/ui';

import { t } from './tokens';

export type TabItem = {
  readonly id: string;
  readonly label: string;
};

export function TabBar(props: {
  readonly label: string;
  readonly items: readonly TabItem[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
}) {
  if (props.items.length === 0) {
    return <Box sx={barSx} accessibilityLabel={props.label} />;
  }
  return (
    <ScrollView
      horizontal
      frameSx={barSx}
      sx={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}
      accessibilityRole="tablist"
      accessibilityLabel={props.label}
    >
      {props.items.map((item) => {
        const selected = item.id === props.selectedId;
        return (
          <Pressable
            key={item.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            sx={[tabSx, selected ? tabActiveSx : null]}
            onPress={() => props.onSelect(item.id)}
          >
            <Text sx={{ color: selected ? t.accent : t.text, fontSize: 12 }}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const barSx = {
  flexDirection: 'row',
  gap: 4,
  paddingVertical: 6,
  paddingHorizontal: 12,
  borderBottomWidth: 1,
  borderBottomColor: t.border,
  backgroundColor: t.panel,
  minHeight: 36,
} as const;

const tabSx = {
  borderWidth: 1,
  borderColor: t.border,
  backgroundColor: t.control,
  borderRadius: 4,
  paddingVertical: 4,
  paddingHorizontal: 10,
} as const;

const tabActiveSx = {
  borderColor: t.accent,
  backgroundColor: t.accentSoft,
} as const;
