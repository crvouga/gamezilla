import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export function hapticSelection() {
  if (Platform.OS === 'web') return;
  void Haptics.selectionAsync();
}

export function hapticSuccess() {
  if (Platform.OS === 'web') return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

export function hapticError() {
  if (Platform.OS === 'web') return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}

