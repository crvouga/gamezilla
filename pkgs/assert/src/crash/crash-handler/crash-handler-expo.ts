import type { Timers } from '@pkgs/clock';
import * as Clipboard from 'expo-clipboard';
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

/** RN Alert always dismisses its action buttons; we re-show so Copy does not end the crash UI. */
function showAssertionAlert(fullText: string, timers: Timers): void {
  Alert.alert(
    'Assertion failed',
    truncate(fullText),
    [
      {
        text: 'Copy error',
        onPress: () => {
          void Clipboard.setStringAsync(`'Assertion failed: ${fullText}`);
          timers.setTimeout(() => showAssertionAlert(fullText, timers), 0);
        },
      },
      {
        text: 'Reload',
        onPress: () => {
          try {
            DevSettings.reload();
          } catch {
            // DevSettings may be missing outside Expo Go.
          }
        },
      },
    ],
    {
      cancelable: false,
    }
  );
}

/**
 * iOS/Android assertion UI: blocking Alert with Copy error + Reload (same spirit as the browser overlay).
 * Register with `Assert.registerCrashHandler` (or the `assert` singleton) from the Expo app.
 * Use static RN imports here; only import this module from native-capable entry points.
 */
export class ExpoCrashHandler implements CrashHandler {
  readonly priority = 20;

  constructor(private readonly timers: Timers) {}

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
    const fullText = body + suffix;

    showAssertionAlert(fullText, this.timers);
  }
}
