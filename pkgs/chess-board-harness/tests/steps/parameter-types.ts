import type {
  PieceName,
  Side,
} from '@pkgs/chess-board-harness/interaction-fixtures';
import { defineParameterType } from '@pkgs/gherkin-shared/registry';

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
