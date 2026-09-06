import { useEffect, useRef } from 'react';

/**
 * Keeps the latest value in a ref without widening hook dependency arrays.
 */
export function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}
