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
  const tags = {
    Event: 'Multiplayer chess',
    White: safeTag(metadata.participants[0].name),
    Black: safeTag(metadata.participants[1].name),
    Result: RESULTS[metadata.outcome],
    TimeControl: timeControl(metadata.timeControl),
    WhiteElo: rating(metadata.participants[0].rating),
    BlackElo: rating(metadata.participants[1].rating),
    Termination: metadata.reason?.startsWith('timeout')
      ? 'time forfeit'
      : 'normal',
  };
  for (const [key, value] of Object.entries(tags)) board.setHeader(key, value);
  return board.pgn();
}
