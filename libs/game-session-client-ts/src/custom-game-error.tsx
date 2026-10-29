import { t } from '@lingui/core/macro';
import { useGamePresentation } from '@pkgs/turn-game-client-ts/turn-games-context';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { type JSX, Show } from 'solid-js';

function errorText(reason: string): string {
  const messages: Readonly<Record<string, string>> = {
    'connection needed': t`Reconnect before changing or playing the game.`,
    'only the creator': t`Only the creator can make this choice.`,
    'not in the space': t`This game is available to people in its space.`,
    'choices changed': t`The game choices changed. Review them and try again.`,
    'board changed': t`The board changed. Review the current turn.`,
    'no such move': t`Choose a position from the moves actually played.`,
    'one side per person': t`A person can have only one side.`,
    'every side needs a participant': t`Fill every place before starting.`,
    'draw agreement needs every participant to be a person': t`A draw needs every participant to be a person.`,
    'both sides need participants': t`Fill every place before starting.`,
    'every person must be ready': t`Every person must be ready before starting.`,
    'already started': t`Game choices are fixed after the start.`,
    finished: t`This game is finished.`,
    cancelled: t`This game is cancelled.`,
    'invalid time choice': t`Choose whole minutes from 1 to 180 and whole added seconds from 0 to 60.`,
    'difficulty not offered': t`Choose a bot difficulty offered by this game.`,
    'move is illegal': t`That move is not legal in this position.`,
    'only the participant to move may play': t`Only the participant whose turn it is can move.`,
    'not your invitation': t`That invitation is no longer yours to accept or decline.`,
    'not an open place': t`That side is no longer open.`,
    'not your side': t`You do not control that side.`,
    'not a participant': t`Only a participant can make this choice.`,
    'not the other participant': t`Only another participant can answer a draw offer.`,
    'not started': t`Start the game before playing.`,
    'finish or cancel first': t`Finish or cancel this game before creating another.`,
    'person not in the space': t`Invite a person who is in this space.`,
    'draw agreement needs two people': t`Draw agreement is available between two people.`,
    'side not available': t`That side is not available to you.`,
    'cannot be invited': t`This person cannot be invited.`,
    'resign instead': t`Every participant has moved. Resign instead of cancelling.`,
    'offer again after moving': t`You may offer a draw again after your next move.`,
    'may still return': t`The other participant may still return. Wait before claiming the win.`,
    'no invitation': t`There is no invitation for that side.`,
    'no finished game': t`Finish a game before asking for a rematch.`,
    'every side chooses first': t`Every side makes its secret choice before play goes on.`,
    'already chosen': t`Your secret choice is already made for this round.`,
    'nothing to choose now': t`There is no secret choice to make now.`,
    'a stand-in plays your side': t`A stand-in bot is playing your side. Take back your side to play.`,
    'no stand-in plays your side': t`You are already playing your own side.`,
  };
  return messages[reason] ?? t`The choice could not be confirmed. Try again.`;
}

/**
 * A refused choice, as the person is told it: in the game's own words when
 * its rules gave the reason, otherwise the platform's.
 */
export function CustomGameError(props: {
  reason: string;
  /** The position the choice was made at, whose game words its own refusals. */
  position?: string | undefined;
}): JSX.Element {
  const presentation = useGamePresentation();
  const text = (): string => {
    const own =
      props.position === undefined || props.position === ''
        ? undefined
        : presentation(props.position).refusalDescription?.(props.reason);
    return own ?? errorText(props.reason);
  };
  return (
    <Show when={props.reason !== ''}>
      <ErrorState
        variant="compact"
        title={t`That didn't go through`}
        body={text()}
        dataSet={{ testid: 'custom-game-error' }}
      />
    </Show>
  );
}
