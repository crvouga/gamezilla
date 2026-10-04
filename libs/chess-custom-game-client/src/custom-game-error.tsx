import { t } from '@lingui/core/macro';
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
    'both sides need participants': t`Fill both sides before starting.`,
    'every person must be ready': t`Every person must be ready before starting.`,
    'already started': t`Game choices are fixed after the start.`,
    finished: t`This game is finished.`,
    cancelled: t`This game is cancelled.`,
    'invalid time choice': t`Choose whole minutes from 1 to 180 and whole added seconds from 0 to 60.`,
    'move is illegal': t`That move is not legal in this position.`,
    'only the participant to move may play': t`Only the participant whose turn it is can move.`,
    'not your invitation': t`That invitation is no longer yours to accept or decline.`,
    'not an open place': t`That side is no longer open.`,
    'not your side': t`You do not control that side.`,
    'not a participant': t`Only a participant can make this choice.`,
    'not the other participant': t`Only the other participant can answer a draw offer.`,
    'not started': t`Start the game before playing.`,
    'finish or cancel first': t`Finish or cancel this game before creating another.`,
    'person not in the space': t`Invite a person who is in this space.`,
    'draw agreement needs two people': t`Draw agreement is available between two people.`,
  };
  return messages[reason] ?? t`The choice could not be confirmed. Try again.`;
}

export function CustomGameError(props: { reason: string }): JSX.Element {
  return (
    <Show when={props.reason !== ''}>
      <p role="alert" class="text" data-testid="chess-custom-error">
        {errorText(props.reason)}
      </p>
    </Show>
  );
}
