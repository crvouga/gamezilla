import { crashFallback } from './crash-fallback';

let suppressedCount = 0;
/** While true, further assertions only bump {@link suppressedCount} (mirrors single overlay on web). */
let crashUiActive = false;

let rnModule: typeof import('react-native') | null | undefined;

function getReactNative(): typeof import('react-native') | null {
  if (rnModule === undefined) {
    try {
      // Metro supplies this; omit in Node/Bun tests (caught).
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      rnModule = require('react-native');
      if (rnModule === undefined) {
        throw new Error('react-native module is not available');
      }
    } catch {
      rnModule = null;
    }
  }
  return rnModule;
}

/** True in the React Native native runtimes (iOS, Android, etc.), false on web and in Node/Bun. */
export function isExpoNative(): boolean {
  const RN = getReactNative();
  return RN !== null && RN.Platform.OS !== 'web';
}

const CONTEXT_MAX = 6000;

function truncate(s: string): string {
  if (s.length <= CONTEXT_MAX) return s;
  return `${s.slice(0, CONTEXT_MAX)}\n\n… (truncated)`;
}

/**
 * Imperative assertion UI for Expo native: there is no DOM. We mirror the web overlay with a
 * blocking Alert and a Reload action (same spirit as the browser full-screen card).
 */
export function crashExpo(
  message: string,
  context?: Record<string, unknown>
): void {
  const RN = getReactNative();
  if (RN === null) {
    crashFallback(message, context);
    return;
  }

  const { Alert, DevSettings } = RN;

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
