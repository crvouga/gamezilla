declare const __DEV__: boolean;

function isReactScanEnabled(): boolean {
  if (!__DEV__) {
    return false;
  }
  // eslint-disable-next-line expo/no-dynamic-env-var -- opt-out knob for local perf work; Expo inlines `EXPO_PUBLIC_*`.
  const raw = process.env['EXPO_PUBLIC_REACT_SCAN'];
  if (raw === '0' || raw === 'false') {
    return false;
  }
  return true;
}

if (isReactScanEnabled()) {
  // Must load before React — keep this side-effect entry separate from route modules.
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports -- dev-only; stripped when `__DEV__` is false.
  const { scan } = require('react-scan') as typeof import('react-scan');
  scan({
    enabled: true,
    showToolbar: true,
    trackUnnecessaryRenders: true,
  });
}
