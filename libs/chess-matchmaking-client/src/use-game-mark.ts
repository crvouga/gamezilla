import type { Keyword } from '@pkgs/keyword-shared/keyword';
import { asKeyword } from '@pkgs/keyword-shared/keyword';
import { createKvState } from '@pkgs/kv-root-client/solid';
import { jsonKvCodec } from '@pkgs/kv-root-shared/kv-state-codec';
import { type Accessor, createSignal } from 'solid-js';

const GAME_ID_CODEC = jsonKvCodec<string>(
  asKeyword('chess.multiplayer/game-id'),
  (value): value is string => typeof value === 'string'
);

/** This device flipped the board of this multiplayer game. */
export const FLIPPED_GAME = asKeyword('chess.multiplayer/flipped-game');
/** This device gave its low on time warning in this multiplayer game. */
export const WARNED_GAME = asKeyword('chess.multiplayer/low-on-time-warned');

/**
 * A mark this device keeps on one multiplayer game, and on no other: it
 * stores the id of the game it last marked. So the mark stays with the game
 * while the person plays on or leaves the screen, never leaves the device,
 * and a new game or a rematch starts without it.
 */
export function useGameMark(key: Keyword): {
  /** The stored mark has been read; until then nothing is marked. */
  readonly ready: Accessor<boolean>;
  readonly marks: (gameId: string) => boolean;
  readonly mark: (gameId: string, on: boolean) => void;
} {
  const [ready, setReady] = createSignal(false);
  const [marked, setMarked] = createKvState<string>({
    key,
    default: '',
    codec: GAME_ID_CODEC,
    onHydrated: () => setReady(true),
  });
  return {
    ready,
    marks: (gameId) => marked() === gameId,
    mark: (gameId, on) => setMarked(on ? gameId : ''),
  };
}
