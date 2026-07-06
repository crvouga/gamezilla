import type { Page } from '@playwright/test';

type BoardOrientation = 'white' | 'black';

type BoardBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function squareCenter(args: {
  square: string;
  box: BoardBox;
  orientation: BoardOrientation;
}): { x: number; y: number } {
  const { square, box, orientation } = args;
  const file = square.charCodeAt(0) - 97;
  const rank = square.charCodeAt(1)! - 49;
  const cell = box.width / 8;
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
    x: box.x + col * cell + cell / 2,
    y: box.y + row * cell + cell / 2,
  };
}

function parseUci(uci: string): { from: string; to: string } | null {
  const trimmed = uci.trim();
  if (trimmed.length < 4) return null;
  return { from: trimmed.slice(0, 2), to: trimmed.slice(2, 4) };
}

export async function readChessPuzzleExpectedUci(
  page: Page
): Promise<string | null> {
  const node = page.getByTestId('chess-puzzle-expected-uci');
  const text = (await node.textContent())?.trim() ?? '';
  return text.length >= 4 ? text : null;
}

export async function readChessPuzzleBoardOrientation(
  page: Page
): Promise<BoardOrientation> {
  const text =
    (await page.getByTestId('chess-puzzle-board-orientation').textContent()) ??
    'white';
  return text.trim() === 'black' ? 'black' : 'white';
}

export async function dragChessMove(
  page: Page,
  uci: string,
  orientation: BoardOrientation
): Promise<void> {
  const parsed = parseUci(uci);
  if (parsed === null) {
    throw new Error(`Invalid UCI for drag: ${uci}`);
  }
  const board = page.getByTestId('chess-puzzle-board');
  const box = await board.boundingBox();
  if (box === null) {
    throw new Error('Chess board bounding box unavailable');
  }
  const from = squareCenter({ square: parsed.from, box, orientation });
  const to = squareCenter({ square: parsed.to, box, orientation });
  await board.click({
    position: { x: from.x - box.x, y: from.y - box.y },
  });
  await page.waitForTimeout(150);
  await board.click({
    position: { x: to.x - box.x, y: to.y - box.y },
  });
}

export async function dragChessPuzzleExpectedMove(page: Page): Promise<void> {
  const uci = await readChessPuzzleExpectedUci(page);
  if (uci === null) {
    throw new Error('No expected UCI available for chess puzzle');
  }
  const orientation = await readChessPuzzleBoardOrientation(page);
  await dragChessMove(page, uci, orientation);
}
