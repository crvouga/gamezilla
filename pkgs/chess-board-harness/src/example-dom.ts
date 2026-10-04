import {
  chessBoardLayerTestId,
  chessBoardLiveRegionTestId,
  chessBoardProbeTestId,
  chessBoardPromotionTestId,
  parseChessBoardPaint,
  parseChessBoardProbe,
} from '@pkgs/chess-board-core-shared/probe';
import type { Move, Square } from '@pkgs/chess-board-core-shared/types';
import { createPointerInputs } from './example-pointer';
import type { ExampleInputArgs } from './example-pointer';

export function required(root: HTMLElement, selector: string): HTMLElement {
  const el = root.querySelector<HTMLElement>(selector);
  if (el === null) throw new Error(`Missing board control: ${selector}`);
  return el;
}
export function createBoardInputs(args: ExampleInputArgs) {
  function focusSquare(square: Square) {
    const target = required(args.host, `[data-square="${square}"]`);
    target.focus();
    return target;
  }
  function key(square: Square) {
    args.touched();
    const target = focusSquare(square);
    target.dispatchEvent(
      new KeyboardEvent('keydown', {
        bubbles: true,
        key: 'Enter',
      })
    );
  }
  function promotion(choice: 'q' | 'r' | 'b' | 'n' | 'cancel', escape = false) {
    args.touched();
    const target = required(
      args.host,
      `[data-testid="${chessBoardPromotionTestId('example-board', choice)}"]`
    );
    if (escape)
      target.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          key: 'Escape',
        })
      );
    else target.click();
  }
  return {
    ...createPointerInputs(args),
    key,
    focusSquare,
    promotion,
  };
}
type ExampleObservationArgs = {
  host: HTMLElement;
  moves: readonly string[];
  moveRecords: readonly Move[];
  active: () => number;
  sounds: () => readonly string[];
};
function readView(args: ExampleObservationArgs) {
  return {
    pieces: [...args.host.querySelectorAll<HTMLElement>('[data-piece-square]')]
      .map((el) => `${el.dataset['piece']}@${el.dataset['pieceSquare']}`)
      .sort(),
    ghost: args.host.textContent.includes('capture-ghost'),
    holding: [
      ...document.querySelectorAll<HTMLElement>('[data-drag-avatar]'),
    ].some((el) => el.style.display !== 'none'),
    active: args.active(),
    sounds: args.sounds(),
    moves: [...args.moves],
  };
}

export function createBoardObservations(args: ExampleObservationArgs) {
  const layer = (
    name: 'squares' | 'arrows' | 'shapes' | 'feedback' | 'pieces' = 'squares'
  ) =>
    parseChessBoardPaint(
      args.host.querySelector(
        `[data-testid="${chessBoardLayerTestId('example-board', name)}"]`
      )?.textContent ?? ''
    );
  return {
    probe: () =>
      parseChessBoardProbe(
        required(
          args.host,
          `[data-testid="${chessBoardProbeTestId('example-board')}"]`
        ).textContent
      ),
    view: () => readView(args),
    layer,
    moveDetails: () => args.moveRecords.map((move) => ({ ...move })),
    spoken: () =>
      required(
        args.host,
        `[data-testid="${chessBoardLiveRegionTestId('example-board')}"]`
      ).textContent,
    promotionChoices: () =>
      (['q', 'r', 'b', 'n'] as const).filter(
        (choice) =>
          args.host.querySelector(
            `[data-testid="${chessBoardPromotionTestId('example-board', choice)}"]`
          ) !== null
      ),
    square: (square: Square) => {
      const el = required(args.host, `[data-square="${square}"]`);
      return {
        label: el.getAttribute('aria-label'),
        selected: el.getAttribute('aria-pressed'),
        description: el.getAttribute('aria-label'),
      };
    },
  };
}
