import { useStackProps } from '@gamezilla/lib/ui/theme';
import { Stack } from 'expo-router';

export default function AccountStackLayout() {
  const props = useStackProps();
  return (
    <Stack {...props}>
      <Stack.Screen name="index" />
      <Stack.Screen name="device/[deviceId]" />
    </Stack>
  );
}
