import type {
  CustomGame,
  CustomGameSide,
} from '@libs/game-session-shared-ts/custom-game-state';
import {
  customGameStartable,
  customGameTimeLeft,
} from '@libs/game-session-shared-ts/custom-game-state';
import { useModeration } from '@libs/moderation-client-ts/moderation-context';
import { usernameText } from '@libs/moderation-shared-ts/display';
import type { AppModeration } from '@libs/moderation-shared-ts/policy';
import { useProfileColumn } from '@libs/profile-client-ts/use-profile-column';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { createTimedValue } from '@pkgs/clock-client-ts/solid';
import { useGamePresentation } from '@pkgs/turn-game-client-ts/turn-games-context';
import { useGameSideLabel } from '@pkgs/turn-game-client-ts/use-game-side-label';
import type { GamePresentation } from '@pkgs/turn-game-shared-ts/game-presentation';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { GameClock } from '@pkgs/ui-root-client-ts/game-clock';
import type { GameStatusTone } from '@pkgs/ui-root-client-ts/game-status';
import { GameStatus } from '@pkgs/ui-root-client-ts/game-status';
import { WifiOffIcon } from '@pkgs/ui-root-client-ts/icons';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { Text } from '@pkgs/ui-root-client-ts/text';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
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
    case 'local':
      return t`Player on this device`;
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
    return completedGameDescription(game, presentation);
  }
  if (game.status === 'active') {
    if (game.execution !== undefined)
      return game.execution.phase === 'paused'
        ? t`Paused while a player returns.`
        : t`Game in progress.`;
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
        dataSet={{ testid: `custom-game-${props.side}-clock` }}
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
          testId="custom-game-status"
        >
          <Trans>No Custom Game.</Trans>
        </VisuallyHidden>
      }
    >
      {(game) => (
        <GameStatus
          live
          tone={statusTone(game(), props.model.mySide())}
          dataSet={{ testid: 'custom-game-status' }}
          title={
            <>
              <VisuallyHidden>{lineup()} </VisuallyHidden>
              {gameStateDescription(game(), presentation(game().fen))}
            </>
          }
          detail={
            props.model.submitting() ? (
              <Trans>Sending choice…</Trans>
            ) : undefined
          }
          trailing={
            <StackHorizontal align="center" gap="sm">
              <Badge
                intent="neutral"
                label={<Trans>Unrated</Trans>}
                dataSet={{ testid: 'custom-game-unrated' }}
              />
              <TimeControlBadge game={game()} />
            </StackHorizontal>
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
    <Show when={!props.model.connected()}>
      <Notice
        icon={WifiOffIcon}
        dataSet={{ testid: 'custom-game-connection-needed' }}
      >
        <Text variant="inherit" role="status">
          <Show
            when={!props.model.waiting()}
            fallback={
              <Trans>
                Your move will be played when the connection returns.
              </Trans>
            }
          >
            <Show
              when={props.model.canSubmit()}
              fallback={
                <Trans>Connection needed to change or play this game.</Trans>
              }
            >
              <Trans>You are offline. Your local game can continue.</Trans>
            </Show>
          </Show>
        </Text>
      </Notice>
    </Show>
  );
}

function completedGameDescription(
  game: CustomGame,
  presentation: GamePresentation
): string {
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
