import type { JSX, ParentProps } from 'solid-js';

import { PuzzleFeedContext } from './puzzle-feed-context';
import { createPuzzleFeedConfigState } from './use-puzzle-feed-config';
import { usePuzzleFeedSubscription } from './use-puzzle-feed-subscription';

/**
 * Mounts the single feed-config signal for the game surface and keeps the
 * puzzle pool subscribed around the effective rating it resolves to.
 */
export function PuzzleFeedProvider(props: ParentProps): JSX.Element {
  const [config, setConfig, configReady] = createPuzzleFeedConfigState();
  const poolReady = usePuzzleFeedSubscription(config);
  return (
    <PuzzleFeedContext.Provider
      value={{ config, setConfig, poolReady, configReady }}
    >
      {props.children}
    </PuzzleFeedContext.Provider>
  );
}
