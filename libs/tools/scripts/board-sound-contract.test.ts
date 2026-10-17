import { expect, test } from 'bun:test';
import ts from 'typescript';
import { boardSoundIssues } from './board-sound-contract';

function issues(body: string) {
  return boardSoundIssues(
    ts.createSourceFile(
      'board.tsx',
      `import { ChessBoard } from '@pkgs/chess-board-root-client/chess-board';
       import { createChessBoardSounds } from '@pkgs/chess-board-root-client/chess-board-sounds';
       import { useSoundsPreference } from '@pkgs/sounds-client/solid';
       const sounds = useSoundsPreference();
       ${body}`,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    ),
    'board.tsx'
  );
}

// regression: custom-game-board-sound-preference
test('boards must follow the app preference or explicitly remain silent', () => {
  expect(issues('<ChessBoard />')).toHaveLength(1);
  expect(issues('<ChessBoard sound={true} />')).toHaveLength(1);
  expect(issues('<ChessBoard sound={!sounds.muted()} />')).toEqual([]);
  expect(issues('<ChessBoard sound={false} />')).toEqual([]);
  expect(issues('<ChessBoard sound={false} {...props} />')).toHaveLength(1);
});

test('sound helpers must follow the app preference or remain silent', () => {
  expect(issues('createChessBoardSounds(() => true)')).toHaveLength(1);
  expect(issues('createChessBoardSounds(() => !sounds.muted())')).toEqual([]);
  expect(issues('createChessBoardSounds(() => false)')).toEqual([]);
});
