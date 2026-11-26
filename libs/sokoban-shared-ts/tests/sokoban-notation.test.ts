import { expect, test } from 'bun:test';
import {
  decodeSokobanBoard,
  encodeSokobanBoard,
} from '@libs/sokoban-shared-ts/sokoban-definition';
import {
  drawSokobanNotation,
  readSokobanNotation,
  writeSokobanNotation,
} from '@libs/sokoban-shared-ts/sokoban-notation';
import { sokobanPuzzleContent as game } from '@libs/sokoban-shared-ts/sokoban-puzzle-content';

const layout = '6#/##3-#/#-.--#/#--$-#/#-@--#/6#';
const layers = 'bridge=D3;item=key@E3;player2=B3;teleport=C3,F3';

test('a position travels as one line or a monospace diagram', () => {
  const parsed = readSokobanNotation('SK1:' + layout.replace('6#', '######'));
  if (!parsed.valid) throw new Error('Dock puzzle was refused');
  expect(writeSokobanNotation(parsed.value)).toBe('SK1:' + layout);
  expect(drawSokobanNotation(parsed.value)).toBe(
    '######\n##   #\n# .  #\n#  $ #\n# @  #\n######'
  );
  const legacy = encodeSokobanBoard(parsed.value.board);
  expect(decodeSokobanBoard(legacy)).toEqual(
    decodeSokobanBoard('SK1:' + layout)
  );
});

test('unknown layers travel intact and require an engine that understands them', () => {
  const base = 'SK1:8#/#@-$-.-#/#6-#/8#';
  const parsed = readSokobanNotation(
    base + ';' + layers.split(';').reverse().join(';')
  );
  if (!parsed.valid) throw new Error('Extended position was refused');
  expect(writeSokobanNotation(parsed.value)).toBe(base + ';' + layers);
  expect(drawSokobanNotation(parsed.value)).toContain('teleport=C3,F3');
  expect(game.rules.initial(base + ';' + layers)).toMatchObject({
    accepted: false,
    issues: [{ code: 'unsupported_extension' }],
  });
});

test('invalid widths, runs, fields and unsupported versions cannot be imported', () => {
  for (const text of [
    'SK2:@$.',
    'SK1:',
    'SK1:01#',
    'SK1:0#',
    'SK1:21#',
    'SK1:3',
    'SK1:a',
    'SK1:#/##',
    'SK1:@@.',
    'SK1:#;',
    'SK1:#;a=',
    'SK1:#;a=x;a=y',
    'SK1:#;a=x\n',
    'SK1:#;a=x=y',
    'SK1:' + '#/'.repeat(20) + '#',
  ]) {
    expect(readSokobanNotation(text).valid).toBe(false);
  }
});

test('all 512 warehouse puzzles ship in canonical notation with distinct layouts', () => {
  const warehouses = game.bundledPacks!.slice(1);
  const puzzles = warehouses.flatMap((pack) => pack.puzzles);
  expect(warehouses.length).toBe(8);
  expect(new Set(puzzles.map((p) => p.definition)).size).toBe(512);
  expect(puzzles.length).toBe(512);
  for (const puzzle of puzzles) {
    const parsed = readSokobanNotation(puzzle.definition);
    if (!parsed.valid) throw new Error(puzzle.id);
    expect(writeSokobanNotation(parsed.value)).toBe(puzzle.definition);
  }
});
