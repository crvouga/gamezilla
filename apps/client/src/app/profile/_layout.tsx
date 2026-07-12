import { useStackProps } from '@pkgs/ui';
import { Stack } from 'expo-router';

/** Nested stack for `/profile/*`; sits outside tabs so the tab bar hides. */
export default function ProfileStackLayout() {
  const props = useStackProps();
  return (
    <Stack {...props}>
      <Stack.Screen name="edit" />
      <Stack.Screen name="username" />
      <Stack.Screen name="handle" />
      <Stack.Screen name="avatar" />
      <Stack.Screen name="friends/index" />
      <Stack.Screen name="friends/requests" />
      <Stack.Screen name="user/[userId]" />
    </Stack>
  );
}
