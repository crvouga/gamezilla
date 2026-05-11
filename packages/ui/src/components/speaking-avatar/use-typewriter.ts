/**
 * Progressively reveals `text` one character at a time.
 *
 * Resets cleanly when `text` or `charDelayMs` changes (the next character
 * is appended on the existing cadence rather than continuing partway
 * through the previous string). The interval is torn down on unmount or
 * effect re-run, so rapid prop changes never leak timers.
 */

import { useEffect, useState } from 'react';

export function useTypewriter(text: string, charDelayMs: number = 30): string {
  const [shown, setShown] = useState<string>(() =>
    text.length > 0 ? text.charAt(0) : ''
  );

  useEffect(() => {
    if (text.length === 0) {
      setShown('');
      return;
    }
    setShown(text.charAt(0));
    if (text.length === 1) {
      return;
    }
    let i = 1;
    const id = setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(id);
      }
    }, charDelayMs);
    return () => {
      clearInterval(id);
    };
  }, [text, charDelayMs]);

  return shown;
}
