/** @jsxImportSource solid-js */
/**
 * Solid bindings for {@link Kv}: a provider plus `createKvState`, the
 * `createSignal`-like primitive persisted via {@link Kv}.
 *
 * `createKvState` hydrates from `kv.get(key)` (async, non-blocking) and writes
 * `kv.put(key, codec.encode(next))` on every change. Without a `<KvProvider>`
 * it degrades to an in-memory signal so isolated previews / tests don't crash.
 *
 * Race safety: a generation counter is bumped on every `set`. A late `get`
 * result whose generation no longer matches is dropped — it cannot clobber a
 * local write that landed after the hydrate started.
 */
import { useClock } from '@pkgs/clock-client-ts/solid';
import type { Keyword } from '@pkgs/keyword-shared-ts/keyword';
import type { Kv, KvRecord } from '@pkgs/kv-root-shared-ts/interface';
import type { KvStateCodec } from '@pkgs/kv-root-shared-ts/kv-state-codec';
import type { Logger } from '@pkgs/logger-shared-ts/logger';
import { createLogger } from '@pkgs/logger-shared-ts/logger';
import { defineContext } from '@pkgs/solid-context-client-ts/define-context';
import {
  type Accessor,
  createSignal,
  type JSX,
  onCleanup,
  type ParentProps,
  untrack,
} from 'solid-js';

const KvContext = defineContext<Kv>('Kv');

export type KvProviderProps = ParentProps<{ readonly value: Kv }>;

/** Injects the platform {@link Kv} backend (web / test fake) for the tree. */
export const KvProvider: (props: KvProviderProps) => JSX.Element =
  KvContext.Provider;

export function useKv(): Kv {
  return KvContext.use();
}

/** Ambient {@link Kv} or `undefined` when no provider is mounted. */
export function useKvOptional(): Kv | undefined {
  return KvContext.useOptional();
}

export type KvStateOptions<T> = {
  /** Namespaced row key, e.g. `asKeyword('ui.prefs/speaking-avatar-muted')`. */
  readonly key: Keyword;
  /** Initial value before hydrate; also the fallback for missing / undecodable records. */
  readonly default: T;
  /** Translates between `T` and a single-row {@link KvRecord}. */
  readonly codec: KvStateCodec<T>;
  /** When `false`, behaves like `createSignal` even if a provider is mounted. */
  readonly persist?: boolean;
  /**
   * Fires once the persisted read has settled (value applied, missing, or
   * failed). With no Kv provider it fires on a microtask. Not called after
   * unmount.
   */
  readonly onHydrated?: () => void;
};

export type KvStateSetter<T> = (next: T | ((prev: T) => T)) => void;

/**
 * Pure helper: the codec's decoded value or `null` if the record is missing /
 * malformed (caller falls back to default).
 */
export function decodePersistedRecord<T>(
  record: KvRecord | null,
  codec: KvStateCodec<T>
): T | null {
  if (record === null) return null;
  const decoded = codec.decode(record);
  return decoded ?? null;
}

function persistValue<T>(args: {
  readonly kv: Kv;
  readonly key: Keyword;
  readonly codec: KvStateCodec<T>;
  readonly value: T;
  readonly log: Logger;
}): void {
  const { kv, key, codec, value, log } = args;
  void kv.put(key, codec.encode(value)).catch((error: unknown) => {
    log.error('persist failed', {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

export function createKvState<T>(
  options: KvStateOptions<T>
): [Accessor<T>, KvStateSetter<T>] {
  const { key, default: defaultValue, codec, persist = true } = options;
  const kv = KvContext.useOptional();
  const clock = useClock();
  const log = createLogger({ name: 'kv-state', now: clock.now });
  const enabled = kv !== undefined && persist;

  const [value, setValueRaw] = createSignal<T>(defaultValue);
  let generation = 0;
  let cancelled = false;
  const notifyHydrated = (): void => {
    if (!cancelled) options.onHydrated?.();
  };
  onCleanup(() => {
    cancelled = true;
  });

  if (enabled) {
    const myGen = ++generation;
    void kv
      .get(key)
      .then((record) => {
        if (cancelled || myGen !== generation) return;
        const decoded = decodePersistedRecord(record, codec);
        if (decoded === null) return;
        setValueRaw(() => decoded);
      })
      .catch((error: unknown) => {
        log.error('hydrate failed', {
          key,
          error: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(notifyHydrated);
  } else {
    queueMicrotask(notifyHydrated);
  }

  const setValue: KvStateSetter<T> = (updater) => {
    const next =
      typeof updater === 'function'
        ? (updater as (prev: T) => T)(untrack(value))
        : updater;
    setValueRaw(() => next);
    if (enabled) {
      generation += 1;
      persistValue({ kv, key, codec, value: next, log });
    }
  };

  return [value, setValue];
}
