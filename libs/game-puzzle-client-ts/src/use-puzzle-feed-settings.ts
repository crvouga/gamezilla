import { useMyId } from '@libs/auth-client-ts/use-current-user';
import type { PuzzleFeedConfig } from '@libs/game-puzzle-shared-ts/feed-config';
import {
  encodePuzzleFeedConfig,
  puzzleFeedConfigFingerprint,
  resolveEffectivePuzzleRating,
} from '@libs/game-puzzle-shared-ts/feed-config';
import { useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import {
  type Accessor,
  createComputed,
  createMemo,
  createSignal,
  on,
  untrack,
} from 'solid-js';
import { usePuzzleFeedState } from './puzzle-feed-context';
import { usePuzzleGame } from './puzzle-game-context';
import type {
  PuzzleFeedSettingsModel,
  PuzzleFeedSettingsStatus,
} from './puzzle-play-screen-model';
import { useDeniedView } from './use-denied-view';
import { usePuzzleFeedConfig } from './use-puzzle-feed-config';
import { usePuzzleFeedPoolStats } from './use-puzzle-feed-pool-stats';
import { usePuzzleProfileRatings } from './use-puzzle-profile-ratings';

/**
 * The draft the settings screens edit: a copy of the saved settings taken
 * each time the settings are entered (and once they are read, when entered
 * before that), so an edit never writes the account's saved choices. Taken
 * before the settings are drawn, so a discarded edit is never shown again.
 */
function createFeedSettingsDraft(args: {
  readonly saved: Accessor<PuzzleFeedConfig>;
  readonly editing: Accessor<boolean>;
  readonly ready: Accessor<boolean>;
}): {
  readonly draft: Accessor<PuzzleFeedConfig>;
  readonly setDraft: (next: PuzzleFeedConfig) => void;
  /** What the feed serves from, as it stood when the settings were entered. */
  readonly entered: Accessor<string | null>;
} {
  const [draft, setDraft] = createSignal(untrack(args.saved));
  const [entered, setEntered] = createSignal<string | null>(null);
  // An edit made here is kept even if the saved settings are read again.
  let edited = false;
  createComputed(
    on([args.editing, args.ready], ([editing]) => {
      if (!editing) {
        setEntered(null);
        edited = false;
        return;
      }
      if (edited) return;
      const saved = untrack(args.saved);
      setDraft(saved);
      setEntered(puzzleFeedConfigFingerprint(saved));
    })
  );
  return {
    draft,
    setDraft: (next) => {
      edited = true;
      setDraft(next);
    },
    entered,
  };
}

/**
 * The feed settings for the puzzle screens: what is saved, the draft the
 * settings screens edit while `editing`, and Done, which saves the draft,
 * asks for a puzzle that fits when the feed itself changed (`onApplied`)
 * and leaves the settings (`onClose`).
 */
export function usePuzzleFeedSettings(args: {
  /** A settings screen is shown. */
  readonly editing: Accessor<boolean>;
  readonly onApplied: () => void;
  readonly onClose: () => void;
}): Accessor<PuzzleFeedSettingsModel> {
  const myId = useMyId();
  const { profileRating } = usePuzzleProfileRatings(myId);
  const [saved, setSaved] = usePuzzleFeedConfig();
  const feed = usePuzzleFeedState();
  const { client } = usePuzzleGame();
  // Customizing the feed is for accounts; a guest is invited to sign in.
  const customize = useDecision(PERMISSION.puzzlesCustomizeFeed);
  const denial = useDeniedView({
    get decision() {
      return customize();
    },
    testId: Handles.chessPuzzleFeedLocked,
  });
  const { draft, setDraft, entered } = createFeedSettingsDraft({
    saved,
    editing: args.editing,
    ready: feed.configReady,
  });
  const pool = usePuzzleFeedPoolStats(draft);
  const targetOf = (config: PuzzleFeedConfig): number =>
    resolveEffectivePuzzleRating({ config, profileRating: profileRating() });
  const status = (): PuzzleFeedSettingsStatus => {
    if (!customize().allowed) return 'locked';
    return feed.configReady() ? 'ready' : 'loading';
  };
  const onDone = (): void => {
    const next = draft();
    const refit = entered() !== puzzleFeedConfigFingerprint(next);
    if (encodePuzzleFeedConfig(saved()) !== encodePuzzleFeedConfig(next))
      setSaved(next);
    if (entered() !== null && refit) args.onApplied();
    args.onClose();
  };
  return createMemo<PuzzleFeedSettingsModel>(() => ({
    status: status(),
    denial: denial(),
    saved: saved(),
    savedReady: feed.configReady(),
    savedTarget: targetOf(saved()),
    draft: draft(),
    draftTarget: targetOf(draft()),
    profileRating: profileRating(),
    matched: pool.matched(),
    total: pool.total(),
    themes: client.themes ?? null,
    onChange: (patch) => setDraft({ ...draft(), ...patch }),
    onDone,
  }));
}
