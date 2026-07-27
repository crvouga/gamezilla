/**
 * `ExplorerList` -- renders registered components grouped by category.
 *
 * App-agnostic: navigation is handled via the `onSelect` callback. Reactive
 * to runtime registrations via {@link useComponentRegistry} when no
 * `entries` override is supplied.
 *
 * Pass `entries` to render a fixed, caller-owned list (e.g. the chess
 * settings screen passes only chess components so the global UI registry
 * is hidden).
 *
 * Pass `screenBodyBleed` when nested under a non-scrolling {@link ScreenBase}
 * body so the scrollbar stays flush with the screen edge.
 */

import { useMemo } from 'react';
import { View } from 'react-native';
import { borderRadius } from '../../theme/scale';
import { Pressable } from '../pressable';
import { ScreenBodyScrollView } from '../screen-base/screen-body-scroll-view';
import { ScrollView } from '../scroll-view';
import { Text } from '../text';
import {
  useComponentRegistry,
  type ComponentEntry,
} from './component-registry';

export type ExplorerListProps = {
  onSelect: (name: string) => void;
  entries?: readonly ComponentEntry[];
  /**
   * When true, bleeds under ScreenBase body horizontal padding so the
   * scrollbar is flush. Omit outside ScreenBase (e.g. chess settings embeds).
   */
  screenBodyBleed?: boolean;
};

export function ExplorerList({
  onSelect,
  entries,
  screenBodyBleed = false,
}: ExplorerListProps) {
  const globalRegistry = useComponentRegistry();
  const registry = entries ?? globalRegistry;
  const categories = useMemo(
    () => [...new Set(registry.map((c) => c.category))],
    [registry]
  );

  const list = categories.map((cat) => (
    <View key={cat} style={{ gap: 4, marginBottom: 16 }}>
      <Text variant="label" sx={{ color: 'textSecondary' }} label={cat} />
      {registry
        .filter((c) => c.category === cat)
        .map((c) => (
          <Pressable
            key={c.name}
            onPress={() => onSelect(c.name)}
            sx={{
              py: 3,
              px: 4,
              background: 'surface',
              borderRadius: borderRadius.md,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text variant="body" label={c.name} />
            <Text variant="caption" label="›" />
          </Pressable>
        ))}
    </View>
  ));

  if (screenBodyBleed) {
    return (
      <ScreenBodyScrollView sx={{ gap: 6, pb: 16 }}>{list}</ScreenBodyScrollView>
    );
  }

  return <ScrollView sx={{ p: 4, gap: 6, pb: 16 }}>{list}</ScrollView>;
}
