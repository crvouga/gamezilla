import { type Accessor, createSignal, onCleanup } from 'solid-js';

/**
 * Reactive `window.matchMedia` accessor. Returns `false` when `matchMedia` is
 * unavailable (SSR / minimal DOM shims).
 */
function defaultMatchMedia(): ((q: string) => MediaQueryList) | undefined {
  if (typeof window === 'undefined') return undefined;
  // Minimal DOM shims may omit `matchMedia`.
  const fn = (window as { matchMedia?: (q: string) => MediaQueryList })
    .matchMedia;
  return typeof fn === 'function' ? fn.bind(window) : undefined;
}

export function createMediaQuery(
  query: string,
  matchMedia: ((q: string) => MediaQueryList) | undefined = defaultMatchMedia()
): Accessor<boolean> {
  if (matchMedia === undefined) return () => false;
  const mq = matchMedia(query);
  const [matches, setMatches] = createSignal(mq.matches);
  const onChange = (event: MediaQueryListEvent): void => {
    setMatches(event.matches);
  };
  mq.addEventListener('change', onChange);
  onCleanup(() => mq.removeEventListener('change', onChange));
  return matches;
}
