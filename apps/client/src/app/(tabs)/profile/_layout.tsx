import { useStackProps } from '@gamezilla/shared/ui';
import { Stack } from 'expo-router';

export default function ProfileStackLayout() {
  const props = useStackProps();
  return (
    <Stack {...props}>
      <Stack.Screen name="index" />
      <Stack.Screen name="edit" />
      <Stack.Screen name="username" />
      <Stack.Screen name="avatar" />
    </Stack>
  );
}
