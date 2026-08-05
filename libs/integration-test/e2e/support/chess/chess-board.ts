import { by, type Driver } from '@pkgs/ui-testing';

import { sleep } from '../sleep';

type BoardOrientation = 'white' | 'black';

function parseUci(uci: string): { from: string; to: string } | null {
  const trimmed = uci.trim();
  if (trimmed.length < 4) return null;
  return { from: trimmed.slice(0, 2), to: trimmed.slice(2, 4) };
}

/** Square center as ratios within the board (0..1). */
function squareRatios(
  square: string,
  orientation: BoardOrientation
): { xRatio: number; yRatio: number } {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square.charAt(1)) - 1;
  let col: number;
  let row: number;
  if (orientation === 'white') {
    col = file;
    row = 7 - rank;
  } else {
    col = 7 - file;
    row = rank;
  }
  return {
    xRatio: (col + 0.5) / 8,
    yRatio: (row + 0.5) / 8,
  };
}

export async function readChessPuzzleExpectedUci(
  driver: Driver
): Promise<string | null> {
  const text = await driver.getText(by.testId('chess-puzzle-expected-uci'));
  const trimmed = text?.trim() ?? '';
  return trimmed.length >= 4 ? trimmed : null;
}

export async function readChessPuzzleBoardOrientation(
  driver: Driver
): Promise<BoardOrientation> {
  const text =
    (await driver.getText(by.testId('chess-puzzle-board-orientation'))) ??
    'white';
  return text.trim() === 'black' ? 'black' : 'white';
}

export async function dragChessMove(
  driver: Driver,
  uci: string,
  orientation: BoardOrientation
): Promise<void> {
  const parsed = parseUci(uci);
  if (parsed === null) {
    throw new Error(`Invalid UCI for drag: ${uci}`);
  }
  const board = by.testId('chess-puzzle-board');
  const from = squareRatios(parsed.from, orientation);
  const to = squareRatios(parsed.to, orientation);
  await driver.tapAt(board, from);
  await sleep(150);
  await driver.tapAt(board, to);
}

export async function dragChessPuzzleExpectedMove(
  driver: Driver
): Promise<void> {
  const uci = await readChessPuzzleExpectedUci(driver);
  if (uci === null) {
    throw new Error('No expected UCI available for chess puzzle');
  }
  const orientation = await readChessPuzzleBoardOrientation(driver);
  await dragChessMove(driver, uci, orientation);
}
