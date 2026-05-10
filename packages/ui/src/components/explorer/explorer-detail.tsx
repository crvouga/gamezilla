/**
 * `ExplorerDetail` -- renders a single component example by name.
 *
 * Looks up the component in the registry and renders its Example. Reactive
 * to runtime registrations via {@link useComponentRegistry}.
 */

import { View } from 'react-native';
import { ScrollView } from '../scroll-view';
import { Text } from '../text';
import { useComponentRegistry } from './component-registry';

export type ExplorerDetailProps = {
  componentName: string;
};

export function ExplorerDetail({ componentName }: ExplorerDetailProps) {
  const registry = useComponentRegistry();
  const entry = registry.find((c) => c.name === componentName);

  if (!entry) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text
          variant="body"
          label={`Component "${componentName}" not found.`}
        />
      </View>
    );
  }

  const { Example } = entry;

  return (
    <ScrollView sx={{ pb: 16 }}>
      <Example />
    </ScrollView>
  );
}
