import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { Pressable, type PressableProps } from '@gamezilla/shared/ui';

export function HapticTab({
  onPressIn,
  ...rest
}: BottomTabBarButtonProps) {
  return (
    <Pressable
      {...(rest as PressableProps)}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === 'ios') {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPressIn?.(ev);
      }}
    />
  );
}
