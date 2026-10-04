import type {
  CustomGame,
  CustomGameSide,
} from '@libs/chess-custom-game-shared/custom-game-state';
import {
  customGameStartable,
  customGameTimeLeft,
} from '@libs/chess-custom-game-shared/custom-game-state';
import { useProfileColumn } from '@libs/profile-client/use-profile-column';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { createTimedValue } from '@pkgs/clock-client/solid';
import { createMemo, type JSX, Show } from 'solid-js';
import type { CustomGameScreenModel } from './use-custom-game-screen';

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

function gameStateDescription(game: CustomGame): string {
  if (game.status === 'cancelled') return t`Game cancelled.`;
  if (game.status === 'completed') {
    if (game.outcome === 'draw') return t`Game drawn.`;
    return game.outcome.startsWith('white') ? t`White wins.` : t`Black wins.`;
  }
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
    <Show when={props.game.minutes > 0} fallback={<Trans>Untimed</Trans>}>
      <span
        class="textMono"
        data-testid={`chess-custom-${props.side}-clock`}
        aria-label={
          props.side === 'white'
            ? t`White time remaining`
            : t`Black time remaining`
        }
      >
        {clockLabel(seconds())}
      </span>
    </Show>
  );
}

export function CustomGameStatus(props: {
  model: CustomGameScreenModel;
}): JSX.Element {
  const whiteName = useProfileColumn(
    () => props.model.current()?.white.person ?? '',
    'username'
  );
  const blackName = useProfileColumn(
    () => props.model.current()?.black.person ?? '',
    'username'
  );
  const description = createMemo(() => {
    const game = props.model.current();
    if (game === null) return t`No Custom Game.`;
    const white = participantName(game, 'white', whiteName());
    const black = participantName(game, 'black', blackName());
    const state = gameStateDescription(game);
    return t`White: ${white}. Black: ${black}. ${state}`;
  });
  return (
    <div class="box gap-2" data-component="CustomGameStatus">
      <p
        class="textBodyBold"
        role="status"
        aria-live="polite"
        data-testid="chess-custom-status"
      >
        {description()}
      </p>
      <Show when={props.model.current()} keyed>
        {(game) => (
          <div class="box flex-row gap-4">
            <span>
              <Trans>White</Trans> <CustomGameClock game={game} side="white" />
            </span>
            <span>
              <Trans>Black</Trans> <CustomGameClock game={game} side="black" />
            </span>
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
