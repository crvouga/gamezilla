/**
 * Suppress known upstream library warnings we can't fix in our own code.
 *
 * Each entry should reference the upstream issue or PR so we know when to
 * remove it after the next dependency upgrade.
 */
const SUPPRESSED_WARNING_PATTERNS: readonly RegExp[] = [
  // @gorhom/bottom-sheet 5.2.10 passes `pointerEvents` as a prop on its
  // hosting container View, which react-native-web has deprecated in favor
  // of `style.pointerEvents`. Tracked upstream:
  // https://github.com/gorhom/react-native-bottom-sheet/issues/2403
  /props\.pointerEvents is deprecated/,
  // Expo Router warns when `pathname` includes `[param]` and `params` repeats it.
  /Route '.*' with param .* was specified both in the path and as a param/,
  // React DevTools + @shopify/react-native-skia reconciler on web (harmless).
  /React instrumentation encountered an error: Error: Invalid argument not valid semver/,
  // react-native-svg still reads `element.ref` on web under React 19.
  /Accessing element\.ref was removed in React 19/,
  // Chrome a11y intervention when stack screens hide focused elements.
  /Blocked aria-hidden on an element because its descendant retained focus/,
];

function argText(arg: unknown): string {
  if (typeof arg === 'string') return arg;
  if (arg instanceof Error) return arg.message;
  return '';
}

/** LogBox passes `console.error('…%s', err)` — match across all args, not just the template. */
function shouldSuppress(args: readonly unknown[]): boolean {
  if (args.length === 0) return false;
  const combined = args.map(argText).join(' ');
  return SUPPRESSED_WARNING_PATTERNS.some((pattern) => pattern.test(combined));
}

export function suppressThirdPartyWarnings(): void {
  if (typeof console === 'undefined') return;
  const originalWarn = console.warn.bind(console);
  const originalError = console.error.bind(console);
  console.warn = (...args: unknown[]) => {
    if (shouldSuppress(args)) return;
    originalWarn(...args);
  };
  console.error = (...args: unknown[]) => {
    if (shouldSuppress(args)) return;
    originalError(...args);
  };
}
