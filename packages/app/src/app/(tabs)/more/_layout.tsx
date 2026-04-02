import { Stack } from 'expo-router';

export default function MoreLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'More' }} />
      <Stack.Screen name="patch-db" options={{ title: 'Patch DB Playground' }} />
      <Stack.Screen
        name="peer-store"
        options={{ title: 'Peer Store Playground' }}
      />
    </Stack>
  );
}
