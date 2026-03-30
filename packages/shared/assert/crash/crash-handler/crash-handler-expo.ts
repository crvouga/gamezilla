import { Alert, DevSettings, Platform } from 'react-native';

import type { CrashHandler } from './crash-handler';

let suppressedCount = 0;
/** While true, further assertions only bump {@link suppressedCount} (mirrors single overlay on web). */
let crashUiActive = false;

const CONTEXT_MAX = 6000;

function truncate(s: string): string {
  if (s.length <= CONTEXT_MAX) return s;
  return `${s.slice(0, CONTEXT_MAX)}\n\n… (truncated)`;
}

/**
 * iOS/Android assertion UI: blocking Alert + Reload (same spirit as the browser overlay).
 * Register with `Assert.registerCrashHandler` (or the `assert` singleton) from the Expo app.
 * Use static RN imports here; only import this module from native-capable entry points.
 */
export class ExpoCrashHandler implements CrashHandler {
  readonly priority = 20;

  match(): boolean {
    return Platform.OS !== 'web';
  }

  crash(message: string, context?: Record<string, unknown>): void {
    if (crashUiActive) {
      suppressedCount++;
      return;
    }
    crashUiActive = true;

    const contextJson =
      context !== undefined ? JSON.stringify(context, null, 2) : '';
    const body = contextJson !== '' ? `${message}\n\n${contextJson}` : message;
    const suffix =
      suppressedCount > 0 ? `\n\n(+${suppressedCount} more suppressed)` : '';

    Alert.alert(
      'Assertion failed',
      truncate(body + suffix),
      [
        {
          text: 'Reload',
          onPress: () => {
            DevSettings.reload();
          },
        },
      ],
      {
        cancelable: false,
      }
    );
  }
}
