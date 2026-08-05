import { useStackProps } from '@pkgs/ui/theme';
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
      <Stack.Screen name="sync" />
      <Stack.Screen name="client-config" />
    </Stack>
  );
}
