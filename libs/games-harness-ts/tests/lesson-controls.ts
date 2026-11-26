import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';

type Action = (ui: Driver) => Promise<void>;
const tap =
  (id: string): Action =>
  (ui) =>
    ui.get(id).tap();
const board = (id: string): Action => tap(`practice-board-${id}`);

function chess(from: string, to: string): Action {
  return async (ui) => {
    await ui.get(`practice-board-square-${from}`).key('enter');
    await ui.get(`practice-board-square-${to}`).key('enter');
  };
}
async function placeWall(ui: Driver) {
  await ui.get('practice-board-mode-h').tap();
  await ui.get('practice-board-action-d6h').tap();
  await ui.get('practice-board-wall-commit').tap();
}
function shot(cell: string): Action {
  return async (ui) => {
    await ui.get(`practice-board-target-${cell}`).tap();
    await ui.get('practice-board-fire').key('enter');
  };
}
function path(start: number): Action {
  return async (ui) => {
    const cell = (n: number) => ui.get(`numberlink-board-cell-${n}`);
    await cell(start).key('enter');
    await cell(start).key('arrowRight');
    await cell(start + 1).key('arrowRight');
    await cell(start + 2).key('enter');
  };
}
function word(tiles: readonly (readonly [number, string])[]): Action {
  return async (ui) => {
    for (const [tile, cell] of tiles) {
      await ui.get(`word-tiles-puzzle-rack-${tile}`).tap();
      await ui.get(`word-tiles-puzzle-cell-${cell}`).tap();
    }
    await ui.get('word-tiles-puzzle-submit').wait('enabled');
    await ui.get('word-tiles-puzzle-submit').tap();
  };
}
const words = [
  word([
    [11, 'g8'],
    [0, 'h8'],
    [80, 'i8'],
  ]),
  word([[76, 'j8']]),
];
const ride = [board('white-pad-up'), board('white-pad-right')];

export const practiceControls: Readonly<Record<string, readonly Action[]>> = {
  chess: [chess('e2', 'e4'), chess('e4', 'd5'), chess('h5', 'f7')],
  'connect-four': [board('column-4'), board('column-4')],
  battleship: [shot('f10'), shot('g10')],
  hearts: [board('card-2C'), board('card-4C')],
  quoridor: [board('action-e2'), placeWall, board('action-e9')],
  'quoridor-hill': [board('action-e2'), placeWall, board('action-e5')],
  sokoban: [tap('sokoban-move-right'), tap('sokoban-move-right')],
  numberlink: [path(0), path(3)],
  pong: [
    (ui) => ui.get('practice-board').key('arrowUp'),
    (ui) => ui.get('practice-board').key('arrowDown'),
  ],
  'word-tiles': words,
  'word-tiles-3': words,
  'word-tiles-4': words,
  'light-cycles': ride,
  'light-cycles-3': ride,
  'light-cycles-4': ride,
};
