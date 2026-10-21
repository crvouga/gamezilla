import { useMyId } from '@libs/auth-client-ts/use-current-user';
import type { PuzzleFeedConfig } from '@libs/game-puzzle-shared-ts/feed-config';
import {
  DEFAULT_PUZZLE_FEED_CONFIG,
  decodePuzzleFeedConfig,
  encodePuzzleFeedConfig,
} from '@libs/game-puzzle-shared-ts/feed-config';
import { puzzleOwnerKey } from '@libs/game-puzzle-shared-ts/puzzle-namespace';
import { savePuzzleFeedSettingsMutation } from '@libs/game-puzzle-shared-ts/save-puzzle-feed-settings-mutation';
import { useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';
import {
  createQuery,
  useSyncEngine,
} from '@pkgs/sync-engine-client-ts/sync-engine-context';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
} from 'solid-js';
import type { PuzzleFeedConfigSetter } from './puzzle-feed-context';
import { usePuzzleFeedState } from './puzzle-feed-context';
import { usePuzzleGame } from './puzzle-game-context';

type FeedSettingsRow = { readonly config: string };

/**
 * The account's saved feed choices from the synced row, or `null` before the
 * first save (and for a guest, who has none).
 */
function useSavedFeedConfig(
  key: Accessor<string>,
  paintReady: Accessor<boolean>
): {
  readonly saved: Accessor<PuzzleFeedConfig | null>;
  readonly loading: Accessor<boolean>;
} {
  const { rows, isLoading } = createQuery(() =>
    paintReady() && key().length > 0
      ? sql<FeedSettingsRow>`
          SELECT config
          FROM chess_puzzle_feed_settings
          WHERE id = ${key()}
            AND deleted_at IS NULL
        `
      : sql<FeedSettingsRow>`SELECT '' AS config WHERE false`
  );
  const saved = createMemo(() => {
    const text = rows()[0]?.config;
    return text === undefined ? null : (decodePuzzleFeedConfig(text) ?? null);
  });
  return { saved, loading: isLoading };
}

/**
 * Owns the feed config signal. Call once per game surface (the provider) —
 * every other reader goes through {@link usePuzzleFeedConfig}.
 *
 * An account's choices live in the synced `chess_puzzle_feed_settings` row,
 * so they survive a closed app and reach its other devices; an edit shows at
 * once and holds until the row it saves comes back. A guest cannot customize
 * the feed: they play the default one, and the only change they get is the
 * session-long widening an exhausted feed offers.
 */
export function createPuzzleFeedConfigState(): [
  Accessor<PuzzleFeedConfig>,
  PuzzleFeedConfigSetter,
  Accessor<boolean>,
] {
  const myId = useMyId();
  const { paintReady } = useSyncEngine();
  const mutationClient = useMutationClient();
  const customize = useDecision(PERMISSION.puzzlesCustomizeFeed);
  const { namespace } = usePuzzleGame();
  // The account's settings for this game (its own row in the game's namespace).
  const { saved, loading } = useSavedFeedConfig(
    () => (myId().length > 0 ? puzzleOwnerKey(namespace, myId()) : ''),
    paintReady
  );
  const [pending, setPending] = createSignal<PuzzleFeedConfig | null>(null);

  const config = createMemo(
    () => pending() ?? saved() ?? DEFAULT_PUZZLE_FEED_CONFIG
  );

  // An edit is shown until the saved row catches up with it.
  createEffect(() => {
    const edit = pending();
    const row = saved();
    if (edit === null || row === null || !customize().allowed) return;
    if (encodePuzzleFeedConfig(edit) === encodePuzzleFeedConfig(row)) {
      setPending(null);
    }
  });

  const setConfig: PuzzleFeedConfigSetter = (next) => {
    const value = typeof next === 'function' ? next(config()) : next;
    setPending(value);
    if (!customize().allowed) return;
    // A refused save falls back to the saved choices rather than showing an
    // edit that will never stick.
    const drop = (): void => {
      if (pending() === value) setPending(null);
    };
    void mutationClient
      .mutate(savePuzzleFeedSettingsMutation, {
        config: encodePuzzleFeedConfig(value),
        ...(namespace === '' ? {} : { namespace }),
      })
      .then((result) => {
        if (!result.ok) drop();
      }, drop);
  };

  const configReady = createMemo(
    () => paintReady() && (!customize().allowed || !loading())
  );
  return [config, setConfig, configReady];
}

/** Shared feed config for the mounted game surface (see the feed provider). */
export function usePuzzleFeedConfig(): [
  Accessor<PuzzleFeedConfig>,
  PuzzleFeedConfigSetter,
] {
  const state = usePuzzleFeedState();
  return [state.config, state.setConfig];
}
