import { matchFont, type SkFont, Skia } from '@shopify/react-native-skia';
import { Platform } from 'react-native';

/**
 * System font for coordinate labels and text feedback badges.
 *
 * On web, avoid `Skia.Font` — the Skia singleton is created from
 * `JsiSkApi(global.CanvasKit)` at first import. If that import ran before
 * CanvasKit loaded, the closure keeps `undefined` even after bootstrap.
 * Use `globalThis.CanvasKit.Font` once bootstrap has finished.
 */
export function createChessBoardSkiaFont(fontSize: number): SkFont | null {
  try {
    if (Platform.OS === 'ios') {
      return matchFont({ fontSize });
    }
    if (Platform.OS === 'web') {
      const ck = (
        globalThis as unknown as {
          CanvasKit?: { Font: (typeface: null, size: number) => SkFont };
        }
      ).CanvasKit;
      if (ck === undefined) return null;
      return ck.Font(null, fontSize);
    }
    return Skia.Font(undefined, fontSize);
  } catch {
    return null;
  }
}
