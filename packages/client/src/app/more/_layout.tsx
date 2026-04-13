import { Stack } from 'expo-router';

export default function MoreLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="patch-db" />
      <Stack.Screen name="peer-store" />
    </Stack>
  );
}
