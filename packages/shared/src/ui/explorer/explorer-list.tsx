/**
 * `ExplorerList` -- renders all registered components grouped by category.
 *
 * App-agnostic: navigation is handled via the `onSelect` callback.
 */

import { Pressable, View } from 'react-native';
import { useTheme } from '../../theme';
import { Text } from '../text';
import { ScrollView } from '../scroll-view';
import { categories, componentRegistry } from './component-registry';

export type ExplorerListProps = {
  onSelect: (name: string) => void;
};

export function ExplorerList({ onSelect }: ExplorerListProps) {
  const theme = useTheme();

  return (
    <ScrollView sx={{ p: 4, gap: 6, pb: 16 }}>
      {categories.map((cat) => (
        <View key={cat} style={{ gap: 4, marginBottom: 16 }}>
          <Text variant="label" sx={{ color: 'textSecondary' }}>
            {cat.toUpperCase()}
          </Text>
          {componentRegistry
            .filter((c) => c.category === cat)
            .map((c) => (
              <Pressable
                key={c.name}
                onPress={() => onSelect(c.name)}
                style={({ pressed }) => [
                  theme.sx({
                    py: 3,
                    px: 4,
                    background: 'surface',
                    borderRadius: 8,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }),
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text variant="body">{c.name}</Text>
                <Text variant="caption">›</Text>
              </Pressable>
            ))}
        </View>
      ))}
    </ScrollView>
  );
}
