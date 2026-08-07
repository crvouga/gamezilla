import { useEffect } from 'react';

declare const __DEV__: boolean;

function isReactScanEnabled(): boolean {
  if (!__DEV__) {
    return false;
  }
  // Expo inlines EXPO_PUBLIC_*; bracket access required by noPropertyAccessFromIndexSignature. opt-out knob for local perf work; Expo inlines `EXPO_PUBLIC_*`.
  const raw = process.env['EXPO_PUBLIC_REACT_SCAN'];
  if (raw === '0' || raw === 'false') {
    return false;
  }
  return true;
}

/**
 * Web dev overlay for unnecessary re-renders. Initialized after React mounts
 * (see react-scan Next.js App Router pattern) so hook instrumentation sees the
 * same React instance the app uses.
 */
export function ReactScanDev(): null {
  useEffect(() => {
    if (!isReactScanEnabled()) {
      return;
    }
    void import('react-scan').then(({ scan }) => {
      scan({
        enabled: true,
        showToolbar: true,
        trackUnnecessaryRenders: true,
      });
    });
  }, []);
  return null;
}
