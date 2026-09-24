import type { JSX, ParentProps } from 'solid-js';

import { ChessPuzzleFeedContext } from './chess-puzzle-feed-context';
import { createChessPuzzleFeedConfigState } from './use-chess-puzzle-feed-config';
import { useChessPuzzleFeedSubscription } from './use-chess-puzzle-feed-subscription';

/**
 * Mounts the single feed-config signal for the chess surface and keeps the
 * puzzle pool subscribed around the effective rating it resolves to.
 */
export function ChessPuzzleFeedProvider(props: ParentProps): JSX.Element {
  const [config, setConfig, configReady] = createChessPuzzleFeedConfigState();
  const poolReady = useChessPuzzleFeedSubscription(config);
  return (
    <ChessPuzzleFeedContext.Provider
      value={{ config, setConfig, poolReady, configReady }}
    >
      {props.children}
    </ChessPuzzleFeedContext.Provider>
  );
}
