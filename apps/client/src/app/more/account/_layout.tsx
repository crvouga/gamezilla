import { useStackProps } from '@pkgs/ui/theme';
import { Stack } from 'expo-router';

export default function AccountStackLayout() {
  const props = useStackProps();
  return (
    <Stack {...props}>
      <Stack.Screen name="index" />
      <Stack.Screen name="switch" />
      <Stack.Screen name="devices" />
      <Stack.Screen name="providers" />
      <Stack.Screen name="device/[deviceId]" />
    </Stack>
  );
}
