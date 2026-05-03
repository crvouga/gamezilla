import { useStackProps } from '@gamezilla/lib/ui/theme';
import { Stack } from 'expo-router';

export default function MoreLayout() {
  const props = useStackProps();
  return (
    <Stack {...props}>
      <Stack.Screen name="index" />
      <Stack.Screen name="about" />
      <Stack.Screen name="account" />
      <Stack.Screen name="server-status" />
      <Stack.Screen name="theme" />
      <Stack.Screen name="developer" />
      <Stack.Screen name="patch-db" />
      <Stack.Screen name="patch-db-client" />
      <Stack.Screen name="room" />
      <Stack.Screen name="client-config" />
    </Stack>
  );
}
