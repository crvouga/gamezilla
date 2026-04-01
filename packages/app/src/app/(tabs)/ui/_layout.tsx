import { Stack } from 'expo-router';

export default function UIExplorerLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'UI Components' }} />
      <Stack.Screen name="[component]" options={{ title: '' }} />
    </Stack>
  );
}
