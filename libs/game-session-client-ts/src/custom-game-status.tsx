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
import { createTimedValue } from '@pkgs/clock-client-ts/solid';
import { useGamePresentation } from '@pkgs/turn-game-client-ts/turn-games-context';
import { useGameSideLabel } from '@pkgs/turn-game-client-ts/use-game-side-label';
import type { GamePlayerName } from '@pkgs/turn-game-shared-ts/game-frame';
import type { GamePresentation } from '@pkgs/turn-game-shared-ts/game-presentation';
import type { BotDifficulty } from '@pkgs/turn-game-shared-ts/game-rules';
import type {
  GameTurnPillEmphasis,
  GameTurnPillTone,
} from '@pkgs/ui-root-client-ts/game-turn-pill';
import { type Accessor, createMemo } from 'solid-js';
import { botName } from './custom-game-bot-name';
import { useBotLevel } from './custom-game-person';
import type {
  FrameClock,
  FrameConnection,
  FrameStatus,
} from './game-frame-view-types';
import { sideNames } from './side-names';
import type { CustomGameScreenModel } from './use-custom-game-screen';

/**
 * The words and clocks the frame shows about the custom game, read from
 * the screen's model for `GameFrameScreenView`.
 */

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
  viewer: CustomGameSide | null,
  nameOf: GamePlayerName
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
      presentation.frame.turnStatus(game.fen, viewer, game.committed, nameOf) ??
      t`${player} to move.`
    );
  }
  return customGameStartable(game)
    ? t`Ready to start.`
    : t`Waiting for participants and readiness.`;
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

function clockLabel(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Seconds left on `side`'s clock now; the full time while set up. */
function secondsLeft(
  game: CustomGame | null,
  side: CustomGameSide,
  now: number
): number {
  if (game === null || game.minutes <= 0 || !game.sides.includes(side))
    return 0;
  return game.status === 'configuring'
    ? game.minutes * 60
    : Math.ceil(customGameTimeLeft(game, side, now) / 1000);
}

/** What `side`'s clock shows now (`4:59`), ticking while it runs. */
export function useSideClock(
  model: CustomGameScreenModel,
  side: CustomGameSide
): Accessor<FrameClock | null> {
  const seconds = createTimedValue(
    (now) => secondsLeft(model.current(), side, now),
    (left, now) => {
      const game = model.current();
      return game !== null &&
        game.minutes > 0 &&
        game.status === 'active' &&
        game.turn === side &&
        left > 0
        ? now + customGameTimeLeft(game, side, now) - (left - 1) * 1000
        : null;
    }
  );
  return () => {
    const game = model.current();
    if (game === null || game.minutes <= 0) return null;
    return {
      value: clockLabel(seconds()),
      active: game.status === 'active' && game.turn === side,
    };
  };
}

/** Every side's clock, ticking while it runs. */
export function useSideClocks(
  model: CustomGameScreenModel
): Readonly<Record<CustomGameSide, Accessor<FrameClock | null>>> {
  return Object.fromEntries(
    CUSTOM_GAME_SIDES.map((side) => [side, useSideClock(model, side)])
  ) as Record<CustomGameSide, Accessor<FrameClock | null>>;
}

/**
 * The line is only a default (`<Side> to move.`, or `Game in progress.`
 * while a real-time game runs): the game has no line of its own about the
 * turn (see `gameStateDescription`).
 */
function plainTurnLine(
  game: CustomGame,
  presentation: GamePresentation,
  viewer: CustomGameSide | null,
  nameOf: GamePlayerName
): boolean {
  return (
    game.status === 'active' &&
    game.awaiting.length === 0 &&
    game.execution?.phase !== 'paused' &&
    !game.standIns.includes(game.turn) &&
    presentation.frame.turnStatus(game.fen, viewer, game.committed, nameOf) ===
      null
  );
}

/** Where the game stands, in one line; `null` with no game. */
export function useFrameStatus(
  model: CustomGameScreenModel
): Accessor<FrameStatus | null> {
  const lineup = useLineupDescription(model);
  const names = useSeatNames(model);
  const nameOf: GamePlayerName = (side) => names[side]() || null;
  const presentation = useGamePresentation();
  return createMemo(() => {
    const game = model.current();
    if (game === null) return null;
    return {
      lineup: lineup(),
      description: gameStateDescription(
        game,
        presentation(game.fen),
        model.mySide(),
        nameOf
      ),
      plainTurn: plainTurnLine(
        game,
        presentation(game.fen),
        model.mySide(),
        nameOf
      ),
      // While the viewer's choice is sent, it is no longer their turn to act.
      emphasis: frameViewerHeld(model)
        ? 'neutral'
        : statusEmphasis(game, model.mySide()),
      tone: statusTone(game),
      sending: model.submitting(),
      minutes: game.minutes,
      increment: game.increment,
    };
  });
}

/** The connection, as the offline notice words it. */
export function frameConnection(
  model: Pick<CustomGameScreenModel, 'connected' | 'waiting' | 'canSubmit'>
): FrameConnection {
  if (model.connected()) return 'online';
  if (model.waiting()) return 'waiting';
  return model.canSubmit() ? 'offline-local' : 'needed';
}

/**
 * The viewer cannot act now, so nothing may say it is their move: their
 * choice is being sent, waits for the connection, or needs it. A local
 * game that can go on offline is not held.
 */
export function frameViewerHeld(
  model: Pick<
    CustomGameScreenModel,
    'submitting' | 'connected' | 'waiting' | 'canSubmit'
  >
): boolean {
  if (model.submitting()) return true;
  const connection = frameConnection(model);
  return connection === 'needed' || connection === 'waiting';
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

/** A person's moderated username, or `''` while it is unknown. */
export function usePersonName(person: () => string): () => string {
  const name = useProfileColumn(person, 'username');
  const moderation = useModeration();
  return () => shownName(moderation(), name(), person()) ?? '';
}
