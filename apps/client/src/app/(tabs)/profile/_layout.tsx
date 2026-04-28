import { useStackProps } from '@gamezilla/lib/ui';
import { Stack } from 'expo-router';

export default function ProfileStackLayout() {
  const props = useStackProps();
  return (
    <Stack {...props}>
      <Stack.Screen name="index" />
      <Stack.Screen name="edit" />
      <Stack.Screen name="profiles" />
      <Stack.Screen name="username" />
      <Stack.Screen name="avatar" />
    </Stack>
  );
}
