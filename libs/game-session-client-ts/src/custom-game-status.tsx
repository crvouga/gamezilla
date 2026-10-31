import {
  customGameOutcomeReason,
  customGameWinners,
} from '@libs/game-session-shared-ts/custom-game-outcome';
import type {
  CustomGame,
  CustomGameSide,
} from '@libs/game-session-shared-ts/custom-game-state';
import {
  CUSTOM_GAME_SIDES,
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
import type { BotDifficulty } from '@pkgs/turn-game-shared-ts/game-rules';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { GameClock } from '@pkgs/ui-root-client-ts/game-clock';
import type {
  GameTurnPillEmphasis,
  GameTurnPillTone,
} from '@pkgs/ui-root-client-ts/game-turn-pill';
import { GameTurnPill } from '@pkgs/ui-root-client-ts/game-turn-pill';
import { WifiOffIcon } from '@pkgs/ui-root-client-ts/icons';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { Text } from '@pkgs/ui-root-client-ts/text';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
import { createMemo, type JSX, Show } from 'solid-js';
import { botName, useBotLevel } from './custom-game-person';
import { sideNames } from './side-names';
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
  name: string | null,
  level: BotDifficulty | undefined
): string {
  switch (game[side].kind) {
    case 'person':
      return name ?? t`Person`;
    case 'invitation':
      return t`Invited person: ${name ?? t`Person`}`;
    case 'bot':
      return botName(level);
    case 'local':
      return t`Player on this device`;
    case 'open':
      return t`Open place`;
    case 'closed':
      return t`Closed place`;
  }
}

function drawnDescription(reason: string): string {
  if (reason === 'timeout')
    return t`Game drawn because a participant ran out of time.`;
  if (reason === 'participant withdrew')
    return t`Game drawn because a participant withdrew.`;
  return t`Game drawn.`;
}

/**
 * How the game stands, in one line. While a side is to move, the game's own
 * line about the turn (`frame.turnStatus`) replaces the default
 * `<Side> to move.` wherever it has one.
 */
function gameStateDescription(
  game: CustomGame,
  presentation: GamePresentation,
  viewer: CustomGameSide | null
): string {
  if (game.status === 'cancelled') return t`Game cancelled.`;
  if (game.status === 'completed') {
    if (game.outcome === 'draw') return drawnDescription(game.outcomeReason);
    return completedGameDescription(game, presentation);
  }
  if (game.status === 'active') {
    if (game.awaiting.length > 0) {
      const chosen = game.committed.length;
      const total = game.awaiting.length + chosen;
      return t`Every side chooses in secret: ${chosen} of ${total} have chosen.`;
    }
    if (game.execution !== undefined)
      return game.execution.phase === 'paused'
        ? t`Paused while a player returns.`
        : t`Game in progress.`;
    const player = presentation.sideLabel(game.turn);
    if (game.standIns.includes(game.turn))
      return t`${player} to move, played by a stand-in bot.`;
    return (
      presentation.frame.turnStatus(game.fen, viewer, game.committed) ??
      t`${player} to move.`
    );
  }
  return customGameStartable(game)
    ? t`Ready to start.`
    : t`Waiting for participants and readiness.`;
}

function clockLabel(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** What `side`'s clock shows now (`4:59`), ticking while it runs. */
export function useClockLabel(props: {
  readonly game: CustomGame;
  readonly side: CustomGameSide;
}): () => string {
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
  return () => clockLabel(seconds());
}

/** One side's clock. An untimed game has none: its status line says so. */
export function CustomGameClock(props: {
  game: CustomGame;
  side: CustomGameSide;
}): JSX.Element {
  const gameSideLabel = useGameSideLabel();
  const label = useClockLabel(props);
  return (
    <Show when={props.game.minutes > 0}>
      <GameClock
        active={
          props.game.status === 'active' && props.game.turn === props.side
        }
        label={gameSideLabel(props.game.fen, props.side)}
        value={label()}
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

/** The viewer's own turn (or their own choice still awaited) is theirs. */
function statusEmphasis(
  game: CustomGame,
  mySide: CustomGameSide | null
): GameTurnPillEmphasis {
  return game.status === 'active' &&
    mySide !== null &&
    (game.awaiting.length > 0
      ? game.awaiting.includes(mySide)
      : game.turn === mySide)
    ? 'yours'
    : 'neutral';
}

function statusTone(game: CustomGame): GameTurnPillTone {
  return game.status === 'configuring' && customGameStartable(game)
    ? 'success'
    : 'neutral';
}

/** Who holds the side, in plain words: as a listener hears it, and on a chip. */
export function useSeatName(
  model: CustomGameScreenModel,
  side: CustomGameSide
): () => string {
  const person = () => model.current()?.[side].person ?? '';
  const name = useProfileColumn(person, 'username');
  const moderation = useModeration();
  const level = useBotLevel({ model, side });
  return () => {
    const game = model.current();
    return game === null
      ? ''
      : participantName(
          game,
          side,
          shownName(moderation(), name(), person()),
          level()
        );
  };
}

/** What every side's seat calls whoever holds it, as plain words. */
export function useSeatNames(
  model: CustomGameScreenModel
): Readonly<Record<CustomGameSide, () => string>> {
  return Object.fromEntries(
    CUSTOM_GAME_SIDES.map((side) => [side, useSeatName(model, side)])
  ) as Record<CustomGameSide, () => string>;
}

function useLineupDescription(model: CustomGameScreenModel): () => string {
  const gameSideLabel = useGameSideLabel();
  const names = useSeatNames(model);
  return createMemo(() => {
    const game = model.current();
    return game === null
      ? ''
      : game.sides
          .map((side) => `${gameSideLabel(game.fen, side)}: ${names[side]()}.`)
          .join(' ');
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
        <GameTurnPill
          live
          emphasis={statusEmphasis(game(), props.model.mySide())}
          tone={statusTone(game())}
          dataSet={{ testid: 'custom-game-status' }}
          title={
            <>
              <VisuallyHidden>{lineup()} </VisuallyHidden>
              {gameStateDescription(
                game(),
                presentation(game().fen),
                props.model.mySide()
              )}
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
  const winners = customGameWinners(game);
  const reason = game.outcome.includes('resignation')
    ? t`resignation`
    : game.outcome.includes('time')
      ? t`time`
      : game.outcome.includes('stayed away')
        ? t`opponent staying away`
        : presentation.endingLabel(customGameOutcomeReason(game.outcome));
  if (winners.length > 1) {
    const names = sideNames(winners.map(presentation.sideLabel));
    return t`${names} win by ${reason}.`;
  }
  const winner = presentation.sideLabel(winners[0] ?? 'white');
  return t`${winner} wins by ${reason}.`;
}
