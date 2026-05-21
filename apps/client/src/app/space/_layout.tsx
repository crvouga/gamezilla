import { useStackProps } from '@pkgs/ui';
import { Stack } from 'expo-router';

/** Nested stack for `/space/*`; native stack header stays hidden (use in-screen header bars). */
export default function SpaceLayout() {
  const props = useStackProps();
  return <Stack {...props} />;
}
