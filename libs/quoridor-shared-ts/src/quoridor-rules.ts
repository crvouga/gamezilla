import type {
  GameBots,
  GameRecordMetadata,
  GameRules,
  GameSide,
  RecordedMove,
} from '@pkgs/turn-game-shared-ts/game-rules';
import {
  decodeQuoridor,
  encodeQuoridor,
  legalQuoridorActions,
  newQuoridor,
  playQuoridor,
  type Quoridor,
  type QuoridorMode,
  replayQuoridor,
} from './quoridor';
import { chooseQuoridorAction } from './quoridor-bot';

export const QUORIDOR_SIDES = ['white', 'black', 'red', 'blue'] as const;
export const QUORIDOR_IDS = {
  classic: 'quoridor',
  hill: 'quoridor-hill',
} as const;

function recordedQuoridorMoves(game: Quoridor): readonly RecordedMove[] {
  let previous = newQuoridor(game.mode);
  return game.actions.map((action) => {
    const next = playQuoridor(previous, action)!;
    const record = {
      label: action,
      before: encodeQuoridor(previous),
      after: encodeQuoridor(next),
    };
    previous = next;
    return record;
  });
}

export function createQuoridorRules(mode: QuoridorMode): GameRules {
  return {
    id: QUORIDOR_IDS[mode],
    family: 'quoridor',
    sides: mode === 'classic' ? QUORIDOR_SIDES.slice(0, 2) : QUORIDOR_SIDES,
    recognizes: (position) => position.startsWith(`quoridor:1:${mode}:`),
    initial: () => encodeQuoridor(newQuoridor(mode)),
    play(position, action) {
      let game: Quoridor;
      try {
        game = decodeQuoridor(position);
      } catch {
        return null;
      }
      if (game.mode !== mode) return null;
      const next = playQuoridor(game, action);
      if (next === null) return null;
      return {
        position: encodeQuoridor(next),
        history: next.actions.join(','),
        turn: QUORIDOR_SIDES[next.turn] as GameSide,
        label: action,
        winner:
          next.winner === null
            ? null
            : (QUORIDOR_SIDES[next.winner] as GameSide),
        reason:
          next.winner === null
            ? null
            : mode === 'classic'
              ? 'opposite row reached'
              : 'hill reached',
      };
    },
    replay: (actions, ply) =>
      encodeQuoridor(replayQuoridor(mode, actions, ply)),
    legal: (position) => legalQuoridorActions(decodeQuoridor(position)),
    canWin: (_position, side) =>
      (mode === 'hill' ? QUORIDOR_SIDES : QUORIDOR_SIDES.slice(0, 2)).includes(
        side as (typeof QUORIDOR_SIDES)[number]
      ),
    moves: (position) => recordedQuoridorMoves(decodeQuoridor(position)),
  };
}

export const quoridorRules = createQuoridorRules('classic');
export const quoridorHillRules = createQuoridorRules('hill');
export const quoridorBots: GameBots = {
  difficulties: ['easy', 'medium', 'hard'],
  choose: (position, difficulty, random) =>
    chooseQuoridorAction(decodeQuoridor(position), difficulty, random),
};

export function quoridorRecord(
  position: string,
  _history: string,
  metadata: GameRecordMetadata
): string {
  const game = decodeQuoridor(position);
  return JSON.stringify({
    game: QUORIDOR_IDS[game.mode],
    mode: game.mode,
    metadata,
    position,
    actions: game.actions,
  });
}
