/**
 * Platform-specific font stacks.
 * App-agnostic; copy-paste into any React Native app.
 */

import { Platform } from 'react-native';

export type FontStacks = {
  sans: string;
  serif: string;
  rounded: string;
  mono: string;
  /** When using custom loaded fonts (e.g. Nunito), use for semibold body text on Android. */
  sansSemibold?: string;
};

const DEFAULT_FONTS: FontStacks = {
  sans: 'normal',
  serif: 'serif',
  rounded: 'normal',
  mono: 'monospace',
};

export const fonts: FontStacks =
  Platform.select({
    ios: {
      sans: 'system-ui',
      serif: 'ui-serif',
      rounded: 'ui-rounded',
      mono: 'ui-monospace',
    },
    android: {
      sans: 'sans-serif',
      serif: 'serif',
      rounded: 'sans-serif-medium',
      mono: 'monospace',
    },
    web: {
      sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      serif: "Georgia, 'Times New Roman', serif",
      rounded:
        "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
      mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    },
    default: {
      sans: 'sans-serif',
      serif: 'serif',
      rounded: 'sans-serif',
      mono: 'monospace',
    },
  }) ?? DEFAULT_FONTS;
