import type {
  CustomGame,
  CustomGameSide,
} from '@libs/chess-custom-game-shared/custom-game-state';
import {
  customGameStartable,
  customGameTimeLeft,
} from '@libs/chess-custom-game-shared/custom-game-state';
import { useModeration } from '@libs/moderation-client/moderation-context';
import { usernameText } from '@libs/moderation-shared/display';
import type { AppModeration } from '@libs/moderation-shared/policy';
import { useProfileColumn } from '@libs/profile-client/use-profile-column';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { createTimedValue } from '@pkgs/clock-client/solid';
import { GameClock } from '@pkgs/ui-root-client/game-clock';
import { createMemo, type JSX, Show } from 'solid-js';
import type { CustomGameScreenModel } from './use-custom-game-screen';

/** Moderated name for display, or `null` while it is unknown. */
function shownName(
  moderation: AppModeration,
  username: string | null,
  profileId: string
): string | null {
  const text = usernameText(moderation, username, profileId);
  return text.length > 0 ? text : null;
}

function participantName(
  game: CustomGame,
  side: CustomGameSide,
  name: string | null
): string {
  switch (game[side].kind) {
    case 'person':
      return name ?? t`Person`;
    case 'invitation':
      return t`Invited person: ${name ?? t`Person`}`;
    case 'bot':
      return t`Bot`;
    case 'open':
      return t`Open place`;
    case 'closed':
      return t`Closed place`;
  }
}

/** A completed game's result, with how it was won. */
function outcomeDescription(outcome: CustomGame['outcome']): string {
  switch (outcome) {
    case 'white wins by resignation':
      return t`White wins by resignation.`;
    case 'black wins by resignation':
      return t`Black wins by resignation.`;
    case 'white wins by checkmate':
      return t`White wins by checkmate.`;
    case 'black wins by checkmate':
      return t`Black wins by checkmate.`;
    case 'white wins on time':
      return t`White wins on time.`;
    case 'black wins on time':
      return t`Black wins on time.`;
    case 'white wins because black stayed away':
      return t`White wins because Black stayed away.`;
    case 'black wins because white stayed away':
      return t`Black wins because White stayed away.`;
    default:
      return t`Game drawn.`;
  }
}

function gameStateDescription(game: CustomGame): string {
  if (game.status === 'cancelled') return t`Game cancelled.`;
  if (game.status === 'completed') return outcomeDescription(game.outcome);
  if (game.status === 'active')
    return game.turn === 'white' ? t`White to move.` : t`Black to move.`;
  return customGameStartable(game)
    ? t`Ready to start.`
    : t`Waiting for participants and readiness.`;
}

function clockLabel(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function CustomGameClock(props: {
  game: CustomGame;
  side: CustomGameSide;
}): JSX.Element {
  const seconds = createTimedValue(
    (now) =>
      props.game.status === 'configuring'
        ? props.game.minutes * 60
        : Math.ceil(customGameTimeLeft(props.game, props.side, now) / 1000),
    (left, now) =>
      props.game.minutes > 0 &&
      props.game.status === 'active' &&
      props.game.turn === props.side &&
      left > 0
        ? now +
          customGameTimeLeft(props.game, props.side, now) -
          (left - 1) * 1000
        : null
  );
  return (
    <GameClock
      active={props.game.status === 'active' && props.game.turn === props.side}
      label={
        <Show when={props.side === 'white'} fallback={<Trans>Black</Trans>}>
          <Trans>White</Trans>
        </Show>
      }
      value={
        <Show when={props.game.minutes > 0} fallback={<Trans>Untimed</Trans>}>
          {clockLabel(seconds())}
        </Show>
      }
      dataSet={{ testid: `chess-custom-${props.side}-clock` }}
      ariaLabel={
        props.side === 'white'
          ? t`White time remaining`
          : t`Black time remaining`
      }
    />
  );
}

export function CustomGameStatus(props: {
  model: CustomGameScreenModel;
}): JSX.Element {
  const whiteId = () => props.model.current()?.white.person ?? '';
  const blackId = () => props.model.current()?.black.person ?? '';
  const whiteName = useProfileColumn(whiteId, 'username');
  const blackName = useProfileColumn(blackId, 'username');
  const moderation = useModeration();
  const description = createMemo(() => {
    const game = props.model.current();
    if (game === null) return t`No Custom Game.`;
    const white = participantName(
      game,
      'white',
      shownName(moderation(), whiteName(), whiteId())
    );
    const black = participantName(
      game,
      'black',
      shownName(moderation(), blackName(), blackId())
    );
    const state = gameStateDescription(game);
    return t`White: ${white}. Black: ${black}. ${state}`;
  });
  return (
    <div class="box gap-2" data-component="CustomGameStatus">
      <p
        class="text-sm text-text-secondary"
        role="status"
        aria-live="polite"
        data-testid="chess-custom-status"
      >
        {description()}
      </p>
      <Show when={props.model.current()} keyed>
        {(game) => (
          <div class="box flex-row gap-2">
            <CustomGameClock game={game} side="white" />
            <CustomGameClock game={game} side="black" />
          </div>
        )}
      </Show>
      <Show when={!props.model.connected()}>
        <p role="status" data-testid="chess-custom-connection-needed">
          <Trans>Connection needed to change or play this game.</Trans>
        </p>
      </Show>
    </div>
  );
}
