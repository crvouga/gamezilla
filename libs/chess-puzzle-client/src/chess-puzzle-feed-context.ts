import type { ChessPuzzleFeedConfig } from '@libs/chess-puzzle-shared/chess-puzzle-feed-config';
import { defineContext } from '@pkgs/solid-context-client/define-context';
import type { Accessor } from 'solid-js';

/** Replace the feed config, or patch it from the current one. */
export type ChessPuzzleFeedConfigSetter = (
  next:
    | ChessPuzzleFeedConfig
    | ((prev: ChessPuzzleFeedConfig) => ChessPuzzleFeedConfig)
) => void;

/**
 * One shared feed state for the whole chess surface. Every reader (picker,
 * feed bar, settings modal, pool subscription) sees the same config signal,
 * so a saved choice re-picks and re-syncs immediately. The settings modal
 * previews a separate draft until the person saves it.
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
