import { Stack } from 'expo-router';

export default function UIExplorerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[component]" />
    </Stack>
  );
}
