import { useCallback, useState } from 'react';

export function useAsyncAction(onSuccess: () => void) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const run = useCallback(
    async (fn: () => Promise<void | boolean>) => {
      setBusy(true);
      setNote(null);
      try {
        const r = await fn();
        if (r === false) setNote('Nothing to act on (empty list).');
        onSuccess();
      } catch (err) {
        setNote(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [onSuccess]
  );

  return { busy, note, run } as const;
}
