import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * Returns a stable callback identity that always invokes the latest `fn`.
 * Useful for event handlers passed into expensive `useMemo` factories
 * (e.g. gesture recognizers) where we don't want the consumer to recreate
 * its memo every time the parent re-renders.
 *
 * Mirrors React's proposed `useEvent` semantics; intentionally narrow.
 */
export function useStableHandler<TArgs extends readonly unknown[], TReturn>(
  fn: (...args: TArgs) => TReturn
): (...args: TArgs) => TReturn {
  const ref = useRef(fn);
  useLayoutEffect(() => {
    ref.current = fn;
  });
  return useCallback((...args: TArgs) => ref.current(...args), []);
}
