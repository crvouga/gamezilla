/**
 * `useState`-like hook persisted via {@link Kv}.
 *
 * Hydrates from `kv.get(key)` on mount (async, non-blocking) and writes
 * `kv.put(key, codec.encode(next))` on every change. Falls back to
 * in-memory `useState` when no `<KvProvider>` is mounted so storybook
 * previews / isolated tests don't crash.
 *
 * Race safety: a per-instance generation counter is bumped on every
 * `setState`. A late `get` result whose generation no longer matches the
 * current ref is dropped — it cannot clobber a local write that landed
 * after the hydrate started.
 */

import { useClock } from '@pkgs/clock';
import type { Keyword } from '@pkgs/keyword/keyword';
import { createLogger, type Logger } from '@pkgs/logger/logger';
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { Kv, KvRecord } from './interface';
import { useKvOptional } from './kv-context';
import type { KvStateCodec } from './kv-state-codec';

export type UseKvStateOptions<T> = {
  /** Namespaced row key, e.g. `asKeyword('ui.prefs/speaking-avatar-muted')`. */
  key: Keyword;
  /** Initial value before hydrate; also the fallback for missing / undecodable records. */
  default: T;
  /** Translates between `T` and a single-row {@link KvRecord}. */
  codec: KvStateCodec<T>;
  /** When `false`, behaves like `useState` even if a provider is mounted. */
  persist?: boolean;
};

/**
 * Pure helper extracted for tests: returns the codec's decoded value or
 * `null` if the record is missing / malformed (caller falls back to default).
 */
export function decodePersistedRecord<T>(
  record: KvRecord | null,
  codec: KvStateCodec<T>
): T | null {
  if (record === null) return null;
  const decoded = codec.decode(record);
  return decoded === undefined ? null : decoded;
}

function applyUpdater<T>(updater: SetStateAction<T>, prev: T): T {
  return typeof updater === 'function'
    ? (updater as (p: T) => T)(prev)
    : updater;
}

function persistValue<T>(args: {
  kv: Kv;
  key: Keyword;
  codec: KvStateCodec<T>;
  value: T;
  log: Logger;
}): void {
  const { kv, key, codec, value, log } = args;
  void kv.put(key, codec.encode(value)).catch((error: unknown) => {
    log.error('persist failed', {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

export function useKvState<T>(
  options: UseKvStateOptions<T>
): [T, Dispatch<SetStateAction<T>>] {
  const { key, default: defaultValue, codec, persist = true } = options;
  const kv = useKvOptional();
  const clock = useClock();
  const log = useMemo(
    () => createLogger({ name: 'kv-state', now: clock.now }),
    [clock]
  );
  const enabled = kv !== null && persist;

  const [value, setValueRaw] = useState<T>(defaultValue);
  const valueRef = useRef(value);
  valueRef.current = value;
  const genRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const myGen = ++genRef.current;
    let cancelled = false;
    void kv
      .get(key)
      .then((record) => {
        if (cancelled) return;
        if (myGen !== genRef.current) return;
        const decoded = decodePersistedRecord(record, codec);
        if (decoded === null) return;
        valueRef.current = decoded;
        setValueRaw(decoded);
      })
      .catch((error: unknown) => {
        log.error('hydrate failed', {
          key,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, kv, key, codec, log]);

  const setValue = useCallback<Dispatch<SetStateAction<T>>>(
    (updater) => {
      const next = applyUpdater(updater, valueRef.current);
      valueRef.current = next;
      setValueRaw(next);
      if (kv !== null && persist) {
        genRef.current += 1;
        persistValue({ kv, key, codec, value: next, log });
      }
    },
    [kv, persist, key, codec, log]
  );

  return [value, setValue];
}
