import type { MultiplayerGame } from '@libs/chess-matchmaking-shared/game-state';
import { otherPerson } from '@libs/chess-matchmaking-shared/game-state';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { type JSX, Match, Show, Switch } from 'solid-js';

function MultiplayerResult(props: {
  readonly game: MultiplayerGame;
  readonly white: boolean;
}): JSX.Element {
  const won = () => (props.game.outcome === 'white') === props.white;
  return (
    <Switch>
      <Match when={props.game.outcome === 'aborted'}>
        <Trans>The multiplayer game was aborted.</Trans>
      </Match>
      <Match when={props.game.outcome === 'draw'}>
        <Trans>The multiplayer game is drawn.</Trans>
      </Match>
      <Match when={won()}>
        <Trans>You won the multiplayer game.</Trans>
      </Match>
      <Match when={!won()}>
        <Trans>Your opponent won the multiplayer game.</Trans>
      </Match>
    </Switch>
  );
}

function MultiplayerReason(props: { readonly game: MultiplayerGame }) {
  const flagged = () => (props.game.white_ms === 0 ? t`White` : t`Black`);
  return (
    <Switch fallback={<span> {props.game.reason}</span>}>
      <Match when={props.game.reason === 'first move missed'}>
        <span>
          {' '}
          <Trans>The first move wasn't made in time.</Trans>
        </span>
      </Match>
      <Match when={props.game.reason === 'timeout'}>
        <span>
          {' '}
          <Trans>{flagged()} ran out of time.</Trans>
        </span>
      </Match>
      <Match when={props.game.reason === 'timeout vs insufficient material'}>
        <span>
          {' '}
          <Trans>
            {flagged()} ran out of time, but the other side cannot checkmate.
          </Trans>
        </span>
      </Match>
      <Match when={props.game.reason === 'agreement'}>
        <span>
          {' '}
          <Trans>Drawn by agreement.</Trans>
        </span>
      </Match>
    </Switch>
  );
}

/** What a listener hears: colour, turn, offers and the result. */
export function MultiplayerAnnouncement(props: {
  readonly game: MultiplayerGame;
  readonly myId: string;
  readonly opponentName: string;
  readonly opponentRating: string;
}): JSX.Element {
  const white = () => props.game.white_id === props.myId;
  const offeredToMe = (by: string | null) =>
    by === otherPerson(props.game, props.myId);
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="multiplayer-announcement"
    >
      <Show
        when={props.game.outcome === 'ongoing'}
        fallback={<MultiplayerResult game={props.game} white={white()} />}
      >
        <Trans>
          Matched with {props.opponentName}, rated {props.opponentRating}, at{' '}
          {props.game.time_control ?? ''}.
        </Trans>{' '}
        <Show when={white()} fallback={<Trans>You are Black.</Trans>}>
          <Trans>You are White.</Trans>
        </Show>{' '}
        <Show
          when={props.game.turn === props.myId}
          fallback={<Trans>Your opponent's turn.</Trans>}
        >
          <Trans>Your turn.</Trans>
        </Show>
      </Show>
      <Show when={props.game.outcome !== 'ongoing' && props.game.reason}>
        <MultiplayerReason game={props.game} />
      </Show>
      <Show when={offeredToMe(props.game.draw_offer_by)}>
        {' '}
        <Trans>{props.opponentName} offered you a multiplayer draw.</Trans>
      </Show>
      <Show when={offeredToMe(props.game.rematch_offer_by)}>
        {' '}
        <Trans>{props.opponentName} offered you a multiplayer rematch.</Trans>
      </Show>
    </div>
  );
}
