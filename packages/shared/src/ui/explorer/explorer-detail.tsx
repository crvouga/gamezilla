/**
 * `ExplorerDetail` -- renders a single component example by name.
 *
 * Looks up the component in the registry and renders its Example.
 */

import { View } from 'react-native';
import { Text } from '../text';
import { ScrollView } from '../scroll-view';
import { componentRegistry } from './component-registry';

export type ExplorerDetailProps = {
  componentName: string;
};

export function ExplorerDetail({ componentName }: ExplorerDetailProps) {
  const entry = componentRegistry.find((c) => c.name === componentName);

  if (!entry) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text variant="body">Component "{componentName}" not found.</Text>
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
