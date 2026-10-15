import type {
  CustomGame,
  CustomGameSide,
} from '@libs/game-session-shared/custom-game-state';
import {
  customGameStartable,
  customGameTimeLeft,
} from '@libs/game-session-shared/custom-game-state';
import { useModeration } from '@libs/moderation-client/moderation-context';
import { usernameText } from '@libs/moderation-shared/display';
import type { AppModeration } from '@libs/moderation-shared/policy';
import { useProfileColumn } from '@libs/profile-client/use-profile-column';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { createTimedValue } from '@pkgs/clock-client/solid';
import { useGamePresentation } from '@pkgs/turn-game-client/turn-games-context';
import { useGameSideLabel } from '@pkgs/turn-game-client/use-game-side-label';
import type { GamePresentation } from '@pkgs/turn-game-shared/game-presentation';
import { Badge } from '@pkgs/ui-root-client/badge';
import { GameClock } from '@pkgs/ui-root-client/game-clock';
import type { GameStatusTone } from '@pkgs/ui-root-client/game-status';
import { GameStatus } from '@pkgs/ui-root-client/game-status';
import { WifiOffIcon } from '@pkgs/ui-root-client/icons';
import { Notice } from '@pkgs/ui-root-client/notice';
import { VisuallyHidden } from '@pkgs/ui-root-client/visually-hidden';
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

function gameStateDescription(
  game: CustomGame,
  presentation: GamePresentation
): string {
  if (game.status === 'cancelled') return t`Game cancelled.`;
  if (game.status === 'completed') {
    if (game.outcome === 'draw') return t`Game drawn.`;
    const winner = presentation.sideLabel(
      game.outcome.startsWith('white') ? 'white' : 'black'
    );
    const reason = game.outcome.includes('resignation')
      ? t`resignation`
      : game.outcome.includes('time')
        ? t`time`
        : game.outcome.includes('stayed away')
          ? t`opponent staying away`
          : presentation.endingLabel(game.outcome.split(' wins by ')[1] ?? '');
    return t`${winner} wins by ${reason}.`;
  }
  if (game.status === 'active') {
    const player = presentation.sideLabel(game.turn);
    return t`${player} to move.`;
  }
  return customGameStartable(game)
    ? t`Ready to start.`
    : t`Waiting for participants and readiness.`;
}

function clockLabel(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** One side's clock. An untimed game has none: its status line says so. */
export function CustomGameClock(props: {
  game: CustomGame;
  side: CustomGameSide;
}): JSX.Element {
  const gameSideLabel = useGameSideLabel();
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
    <Show when={props.game.minutes > 0}>
      <GameClock
        active={
          props.game.status === 'active' && props.game.turn === props.side
        }
        label={gameSideLabel(props.game.fen, props.side)}
        value={clockLabel(seconds())}
        dataSet={{ testid: `chess-custom-${props.side}-clock` }}
        ariaLabel={gameSideLabel(props.game.fen, props.side)}
      />
    </Show>
  );
}

/** The agreed clock: minutes + added seconds. */
function TimeControlBadge(props: { game: CustomGame }): JSX.Element {
  return (
    <Badge
      intent="neutral"
      label={
        <Show when={props.game.minutes > 0} fallback={<Trans>Untimed</Trans>}>
          {props.game.minutes}+{props.game.increment}
        </Show>
      }
    />
  );
}

function statusTone(
  game: CustomGame,
  mySide: CustomGameSide | null
): GameStatusTone {
  if (game.status === 'active' && mySide !== null && game.turn === mySide)
    return 'active';
  if (game.status === 'configuring' && customGameStartable(game))
    return 'success';
  return 'neutral';
}

/** Who holds each side, as a listener hears it before the game's state. */
function useLineupDescription(model: CustomGameScreenModel): () => string {
  const gameSideLabel = useGameSideLabel();
  const whiteId = () => model.current()?.white.person ?? '';
  const blackId = () => model.current()?.black.person ?? '';
  const whiteName = useProfileColumn(whiteId, 'username');
  const blackName = useProfileColumn(blackId, 'username');
  const moderation = useModeration();
  return createMemo(() => {
    const game = model.current();
    if (game === null) return '';
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
    const first = gameSideLabel(game.fen, 'white');
    const second = gameSideLabel(game.fen, 'black');
    return t`${first}: ${white}. ${second}: ${black}.`;
  });
}

/**
 * Where the game stands, in one line: the eye reads the state beside the
 * seats; a listener, who cannot see the seats, first hears who holds them.
 */
export function CustomGameStatus(props: {
  model: CustomGameScreenModel;
}): JSX.Element {
  const lineup = useLineupDescription(props.model);
  const presentation = useGamePresentation();
  return (
    <Show
      when={props.model.current()}
      fallback={
        <VisuallyHidden
          role="status"
          aria-live="polite"
          testId="chess-custom-status"
        >
          <Trans>No Custom Game.</Trans>
        </VisuallyHidden>
      }
    >
      {(game) => (
        <GameStatus
          live
          tone={statusTone(game(), props.model.mySide())}
          dataSet={{ testid: 'chess-custom-status' }}
          title={
            <>
              <VisuallyHidden>{lineup()} </VisuallyHidden>
              {gameStateDescription(game(), presentation(game().fen))}
            </>
          }
          trailing={
            <div class="flex items-center gap-2">
              <Badge
                intent="neutral"
                label={<Trans>Unrated</Trans>}
                dataSet={{ testid: 'chess-custom-unrated' }}
              />
              <TimeControlBadge game={game()} />
            </div>
          }
        />
      )}
    </Show>
  );
}

export function CustomGameConnectionNotice(props: {
  model: CustomGameScreenModel;
}): JSX.Element {
  return (
    <Show when={!props.model.canSubmit()}>
      <Notice
        icon={WifiOffIcon}
        dataSet={{ testid: 'chess-custom-connection-needed' }}
      >
        <span role="status">
          <Trans>Connection needed to change or play this game.</Trans>
        </span>
      </Notice>
    </Show>
  );
}
