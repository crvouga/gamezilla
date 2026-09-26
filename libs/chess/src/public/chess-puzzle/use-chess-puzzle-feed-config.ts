import { asKeyword } from '@pkgs/keyword/keyword';
import type { KvStateCodec } from '@pkgs/kv/kv-state-codec';
import { createKvState, type KvStateSetter } from '@pkgs/kv/solid';
import { type Accessor, createSignal } from 'solid-js';

import {
  type ChessPuzzleFeedConfig,
  DEFAULT_CHESS_PUZZLE_FEED_CONFIG,
  readChessPuzzleFeedConfig,
} from '../chess-puzzle-feed-config';
import { useChessPuzzleFeedState } from './chess-puzzle-feed-context';

const PUZZLE_FEED_ROW_KEY = asKeyword('chess.prefs/puzzle-feed');
const PUZZLE_FEED_VALUE_ATTR = asKeyword('chess.prefs/value');

const PUZZLE_FEED_CODEC: KvStateCodec<ChessPuzzleFeedConfig> = {
  decode(record) {
    return readChessPuzzleFeedConfig(record[PUZZLE_FEED_VALUE_ATTR]);
  },
  encode(value) {
    return { [PUZZLE_FEED_VALUE_ATTR]: value };
  },
};

/**
 * Owns the persisted feed config signal. Call once per chess surface (the
 * provider) — every other reader goes through {@link useChessPuzzleFeedConfig}.
 */
export function createChessPuzzleFeedConfigState(): [
  Accessor<ChessPuzzleFeedConfig>,
  KvStateSetter<ChessPuzzleFeedConfig>,
  Accessor<boolean>,
] {
  const [configReady, setConfigReady] = createSignal(false);
  const state = createKvState<ChessPuzzleFeedConfig>({
    key: PUZZLE_FEED_ROW_KEY,
    default: DEFAULT_CHESS_PUZZLE_FEED_CONFIG,
    codec: PUZZLE_FEED_CODEC,
    onHydrated: () => setConfigReady(true),
  });
  return [state[0], state[1], configReady];
}

/** Shared feed config for the mounted chess surface (see the feed provider). */
export function useChessPuzzleFeedConfig(): [
  Accessor<ChessPuzzleFeedConfig>,
  KvStateSetter<ChessPuzzleFeedConfig>,
] {
  const state = useChessPuzzleFeedState();
  return [state.config, state.setConfig];
}
