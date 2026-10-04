import { useMyId } from '@libs/auth-client/use-current-user';
import type { ChessPuzzleFeedConfig } from '@libs/chess-puzzle-shared/chess-puzzle-feed-config';
import {
  DEFAULT_CHESS_PUZZLE_FEED_CONFIG,
  decodeChessPuzzleFeedConfig,
  encodeChessPuzzleFeedConfig,
} from '@libs/chess-puzzle-shared/chess-puzzle-feed-config';
import { savePuzzleFeedSettingsMutation } from '@libs/chess-puzzle-shared/save-puzzle-feed-settings-mutation';
import { useDecision } from '@libs/permissions-client/use-can';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import sql from '@pkgs/sql-shared/sql';
import { useMutationClient } from '@pkgs/sync-engine-client/mutation-client-context';
import {
  createQuery,
  useSyncEngine,
} from '@pkgs/sync-engine-client/sync-engine-context';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
} from 'solid-js';
import type { ChessPuzzleFeedConfigSetter } from './chess-puzzle-feed-context';
import { useChessPuzzleFeedState } from './chess-puzzle-feed-context';

type FeedSettingsRow = { readonly config: string };

/**
 * The account's saved feed choices from the synced row, or `null` before the
 * first save (and for a guest, who has none).
 */
function useSavedFeedConfig(
  myId: Accessor<string>,
  paintReady: Accessor<boolean>
): {
  readonly saved: Accessor<ChessPuzzleFeedConfig | null>;
  readonly loading: Accessor<boolean>;
} {
  const { rows, isLoading } = createQuery(() =>
    paintReady() && myId().length > 0
      ? sql<FeedSettingsRow>`
          SELECT config
          FROM chess_puzzle_feed_settings
          WHERE owner_id = ${myId()}
            AND deleted_at IS NULL
        `
      : sql<FeedSettingsRow>`SELECT '' AS config WHERE false`
  );
  const saved = createMemo(() => {
    const text = rows()[0]?.config;
    return text === undefined
      ? null
      : (decodeChessPuzzleFeedConfig(text) ?? null);
  });
  return { saved, loading: isLoading };
}

/**
 * Owns the feed config signal. Call once per chess surface (the provider) —
 * every other reader goes through {@link useChessPuzzleFeedConfig}.
 *
 * An account's choices live in the synced `chess_puzzle_feed_settings` row,
 * so they survive a closed app and reach its other devices; an edit shows at
 * once and holds until the row it saves comes back. A guest cannot customize
 * the feed: they play the default one, and the only change they get is the
 * session-long widening an exhausted feed offers.
 */
export function createChessPuzzleFeedConfigState(): [
  Accessor<ChessPuzzleFeedConfig>,
  ChessPuzzleFeedConfigSetter,
  Accessor<boolean>,
] {
  const myId = useMyId();
  const { paintReady } = useSyncEngine();
  const mutationClient = useMutationClient();
  const customize = useDecision(PERMISSION.puzzlesCustomizeFeed);
  const { saved, loading } = useSavedFeedConfig(myId, paintReady);
  const [pending, setPending] = createSignal<ChessPuzzleFeedConfig | null>(
    null
  );

  const config = createMemo(
    () => pending() ?? saved() ?? DEFAULT_CHESS_PUZZLE_FEED_CONFIG
  );

  // An edit is shown until the saved row catches up with it.
  createEffect(() => {
    const edit = pending();
    const row = saved();
    if (edit === null || row === null || !customize().allowed) return;
    if (
      encodeChessPuzzleFeedConfig(edit) === encodeChessPuzzleFeedConfig(row)
    ) {
      setPending(null);
    }
  });

  const setConfig: ChessPuzzleFeedConfigSetter = (next) => {
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
        config: encodeChessPuzzleFeedConfig(value),
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

/** Shared feed config for the mounted chess surface (see the feed provider). */
export function useChessPuzzleFeedConfig(): [
  Accessor<ChessPuzzleFeedConfig>,
  ChessPuzzleFeedConfigSetter,
] {
  const state = useChessPuzzleFeedState();
  return [state.config, state.setConfig];
}
