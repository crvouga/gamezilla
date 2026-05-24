import { Platform } from 'react-native';

/**
 * React Native Web has no native animated module (`RCTAnimation`). Passing
 * `useNativeDriver: true` there logs a warning and silently falls back to JS.
 * Native iOS/Android keep the driver enabled for transform/opacity animations.
 */
export const USE_NATIVE_DRIVER = Platform.OS !== 'web';
