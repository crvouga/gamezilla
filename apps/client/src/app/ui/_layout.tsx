import { useStackProps } from '@gamezilla/lib/ui';
import { Stack } from 'expo-router';

export default function UIExplorerLayout() {
  const props = useStackProps();
  return (
    <Stack {...props}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[component]" />
    </Stack>
  );
}
