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
];

function shouldSuppress(args: readonly unknown[]): boolean {
  if (args.length === 0) return false;
  const first = args[0];
  if (typeof first !== 'string') return false;
  return SUPPRESSED_WARNING_PATTERNS.some((pattern) => pattern.test(first));
}

export function suppressThirdPartyWarnings(): void {
  if (typeof console === 'undefined') return;
  const originalWarn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    if (shouldSuppress(args)) return;
    originalWarn(...args);
  };
}
