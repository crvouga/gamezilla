import { defineContext } from '@pkgs/solid-context/define-context';
import type { Accessor } from 'solid-js';

import type { ChessPuzzleFeedConfig } from '../chess-puzzle-feed-config';

/** Replace the feed config, or patch it from the current one. */
export type ChessPuzzleFeedConfigSetter = (
  next:
    | ChessPuzzleFeedConfig
    | ((prev: ChessPuzzleFeedConfig) => ChessPuzzleFeedConfig)
) => void;

/**
 * One shared feed state for the whole chess surface. Every reader (picker,
 * feed bar, settings modal, pool subscription) sees the same config signal,
 * so an edit in the modal re-picks and re-syncs immediately instead of
 * living in a per-hook copy until remount.
 */
export type ChessPuzzleFeedState = {
  readonly config: Accessor<ChessPuzzleFeedConfig>;
  readonly setConfig: ChessPuzzleFeedConfigSetter;
  /**
   * True once the pool subscription for the current rating bands finished
   * its first hydrate. Lets the play screen tell "still downloading" from
   * "nothing to play".
   */
  readonly poolReady: Accessor<boolean>;
  /**
   * True once the saved feed config read has settled. Labels whose width
   * depends on that record wait for this so the default cannot paint and
   * then jump to the saved filters.
   */
  readonly configReady: Accessor<boolean>;
};

export const ChessPuzzleFeedContext =
  defineContext<ChessPuzzleFeedState>('ChessPuzzleFeed');

export function useChessPuzzleFeedState(): ChessPuzzleFeedState {
  return ChessPuzzleFeedContext.use();
}
