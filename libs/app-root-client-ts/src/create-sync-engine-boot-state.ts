import type { SyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-port';
import type { MutationRegistry } from '@pkgs/sync-engine-shared-ts/mutations-types';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { type Accessor, createEffect, createSignal } from 'solid-js';

export type ReadySyncEngine = {
  readonly turnGames: TurnGames;
  readonly engine: SyncEngine;
  readonly registry: MutationRegistry;
};

/**
 * One attempt at opening the engine. The promise sits behind a field because
 * a computation that returns a promise is read as its resolved value, and
 * this boot reports its own loading and error phases.
 */
export type SyncEngineBootAttempt = {
  readonly ready: Promise<ReadySyncEngine>;
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
 * continue in the background after `connect()`. A new `boot` attempt
 * (identity switch) resets the phase; a stale resolution is ignored.
 */
export function createSyncEngineBootState(args: {
  readonly boot: Accessor<SyncEngineBootAttempt>;
  readonly warm: Accessor<ReadySyncEngine | null>;
  readonly onError?: ((error: Error) => void) | undefined;
}): Accessor<SyncEngineBootState> {
  const [state, setState] = createSignal<SyncEngineBootState>(() => {
    args.boot();
    return initialBootState(args.warm());
  });

  createEffect(
    () => ({ attempt: args.boot(), warm: args.warm() }),
    ({ attempt }) => {
      let cancelled = false;
      void attempt.ready
        .then((ready) => {
          if (cancelled) return;
          setState({ phase: 'ready', ready });
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          const err = toError(error);
          args.onError?.(err);
          setState({ phase: 'error', error: err });
        });
      return () => {
        cancelled = true;
      };
    }
  );

  return state;
}
