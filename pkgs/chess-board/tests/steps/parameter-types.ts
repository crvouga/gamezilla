import type { PieceName, Side } from '@pkgs/chess-board/harness';
import { defineParameterType } from '@pkgs/gherkin/registry';

defineParameterType({
  name: 'chessSide',
  regexp: /White|Black/,
  transformer: (value: string): Side => value as Side,
});

defineParameterType({
  name: 'chessPiece',
  regexp: /pawn|knight|bishop|rook|queen|king/,
  transformer: (value: string): PieceName => value as PieceName,
});
