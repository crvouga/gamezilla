/**
 * `ExplorerList` -- renders all registered components grouped by category.
 *
 * App-agnostic: navigation is handled via the `onSelect` callback. Reactive
 * to runtime registrations via {@link useComponentRegistry}.
 */

import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '../../theme';
import { borderRadius } from '../../theme/scale';
import { ScrollView } from '../scroll-view';
import { Text } from '../text';
import { useComponentRegistry } from './component-registry';

export type ExplorerListProps = {
  onSelect: (name: string) => void;
};

export function ExplorerList({ onSelect }: ExplorerListProps) {
  const theme = useTheme();
  const registry = useComponentRegistry();
  const categories = useMemo(
    () => [...new Set(registry.map((c) => c.category))],
    [registry]
  );

  return (
    <ScrollView sx={{ p: 4, gap: 6, pb: 16 }}>
      {categories.map((cat) => (
        <View key={cat} style={{ gap: 4, marginBottom: 16 }}>
          <Text variant="label" sx={{ color: 'textSecondary' }} label={cat} />
          {registry
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
                    borderRadius: borderRadius.sm,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }),
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text variant="body" label={c.name} />
                <Text variant="caption" label="›" />
              </Pressable>
            ))}
        </View>
      ))}
    </ScrollView>
  );
}
