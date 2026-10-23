import type { SyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-port';
import type { MutationRegistry } from '@pkgs/sync-engine-shared-ts/mutations-types';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { type Accessor, createEffect, createSignal, onCleanup } from 'solid-js';

export type ReadySyncEngine = {
  readonly turnGames: TurnGames;
  readonly engine: SyncEngine;
  readonly registry: MutationRegistry;
};

export type SyncEngineBootState =
  | { readonly phase: 'loading' }
  | { readonly phase: 'ready'; readonly ready: ReadySyncEngine }
  | { readonly phase: 'error'; readonly error: Error };

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function initialBootState(warm: ReadySyncEngine | null): SyncEngineBootState {
  return warm !== null ? { phase: 'ready', ready: warm } : { phase: 'loading' };
}

/**
 * Tracks the identity-scoped sync engine boot for local reads as soon as
 * SQLite is open. Does **not** wait for network first-sync — session queries
 * continue in the background after `connect()`. A new `boot` promise
 * (identity switch) resets the phase; a stale resolution is ignored.
 */
export function createSyncEngineBootState(args: {
  readonly boot: Accessor<Promise<ReadySyncEngine>>;
  readonly warm: Accessor<ReadySyncEngine | null>;
  readonly onError?: ((error: Error) => void) | undefined;
}): Accessor<SyncEngineBootState> {
  const [state, setState] = createSignal<SyncEngineBootState>(
    initialBootState(args.warm())
  );
  let generation = 0;

  createEffect(() => {
    const promise = args.boot();
    const warm = args.warm();
    const current = ++generation;
    let cancelled = false;
    onCleanup(() => {
      cancelled = true;
    });
    setState(initialBootState(warm));

    void promise
      .then((ready) => {
        if (cancelled || current !== generation) return;
        setState({ phase: 'ready', ready });
      })
      .catch((error: unknown) => {
        if (cancelled || current !== generation) return;
        const err = toError(error);
        args.onError?.(err);
        setState({ phase: 'error', error: err });
      });
  });

  return state;
}
