import type { MultiplayerGame } from '@libs/game-matchmaking-shared-ts/game-state';
import { GameResultHeadline } from '@pkgs/ui-root-client-ts/game-result';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import type { JSX } from 'solid-js';
import {
  MultiplayerStatusDetail,
  type MultiplayerStatusProps,
  MultiplayerStatusTitle,
  multiplayerStatusHasDetail,
} from './multiplayer-status';
import { useMultiplayerViewer } from './use-multiplayer-viewer';

/**
 * How the matched game ended, as the result's headline: who won, then why,
 * a rematch offered to the person and what the game did to their rating.
 * It is the result's live announcement, in the words the line under the
 * board says while the game is played, so a listener hears a rematch offer
 * when it arrives.
 */
export function MultiplayerOutcome(props: MultiplayerStatusProps): JSX.Element {
  return (
    <StackVertical
      role="status"
      aria-live="polite"
      aria-atomic
      testId="multiplayer-announcement"
    >
      <GameResultHeadline
        title={<MultiplayerStatusTitle {...props} />}
        caption={
          multiplayerStatusHasDetail(props) ? (
            <MultiplayerStatusDetail {...props} />
          ) : undefined
        }
      />
    </StackVertical>
  );
}

/** {@link MultiplayerOutcome} for the game as this device's person sees it. */
export function MultiplayerGameOutcome(props: {
  readonly game: MultiplayerGame;
  readonly myId: string;
}): JSX.Element {
  const { viewer, winnerName } = useMultiplayerViewer(
    () => props.game,
    () => props.myId
  );
  return (
    <MultiplayerOutcome
      game={props.game}
      viewer={viewer()}
      winnerName={winnerName()}
      lowOnTime={null}
    />
  );
}
