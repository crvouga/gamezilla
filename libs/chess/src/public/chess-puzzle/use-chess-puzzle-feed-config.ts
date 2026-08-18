import { asKeyword } from '@pkgs/keyword/keyword';
import type { KvStateCodec } from '@pkgs/kv/kv-state-codec';
import { useKvState } from '@pkgs/kv/use-kv-state';
import type { Dispatch, SetStateAction } from 'react';

import {
  type ChessPuzzleFeedConfig,
  DEFAULT_CHESS_PUZZLE_FEED_CONFIG,
  readChessPuzzleFeedConfig,
} from '../chess-puzzle-feed-config';

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

export function useChessPuzzleFeedConfig(): [
  ChessPuzzleFeedConfig,
  Dispatch<SetStateAction<ChessPuzzleFeedConfig>>,
] {
  return useKvState<ChessPuzzleFeedConfig>({
    key: PUZZLE_FEED_ROW_KEY,
    default: DEFAULT_CHESS_PUZZLE_FEED_CONFIG,
    codec: PUZZLE_FEED_CODEC,
  });
}
