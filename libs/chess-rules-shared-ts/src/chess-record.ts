import type { GameRecordMetadata } from '@pkgs/turn-game-shared-ts/game-rules';
import type { Chess } from 'chess.js';

const RESULTS = { white: '1-0', black: '0-1', draw: '1/2-1/2' } as const;
const safeTag = (text: string): string =>
  text.replaceAll('"', "'").replaceAll('\\', '/');
const rating = (text: string | null): string =>
  /^\d+/.exec(text ?? '')?.[0] ?? '';
function timeControl(control: GameRecordMetadata['timeControl']): string {
  if (control === null) return '?';
  return control.daysPerMove > 0
    ? `1/${control.daysPerMove * 86_400}`
    : `${control.minutes * 60}+${control.incrementSeconds}`;
}
export function chessRecord(
  board: Chess,
  metadata: GameRecordMetadata
): string {
  const white = metadata.participants[0];
  const black = metadata.participants[1];
  if (
    metadata.participants.length !== 2 ||
    white === undefined ||
    black === undefined
  )
    throw new Error('A chess record requires exactly two participants');
  if (
    metadata.outcome !== 'white' &&
    metadata.outcome !== 'black' &&
    metadata.outcome !== 'draw'
  )
    throw new Error('A chess record requires a chess side or a draw');
  const tags = {
    Event: 'Multiplayer chess',
    White: safeTag(white.name),
    Black: safeTag(black.name),
    Result: RESULTS[metadata.outcome],
    TimeControl: timeControl(metadata.timeControl),
    WhiteElo: rating(white.rating),
    BlackElo: rating(black.rating),
    Termination: metadata.reason?.startsWith('timeout')
      ? 'time forfeit'
      : 'normal',
  };
  for (const [key, value] of Object.entries(tags)) board.setHeader(key, value);
  return board.pgn();
}
