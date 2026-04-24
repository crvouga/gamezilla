import { useStackProps } from '@gamezilla/lib/ui';
import { Stack } from 'expo-router';

export default function TodosLayout() {
  const props = useStackProps();
  return (
    <Stack {...props}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[listId]" />
    </Stack>
  );
}
