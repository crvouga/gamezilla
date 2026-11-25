import { expect, test } from 'bun:test';
import { SokobanPlayBoard } from '@libs/sokoban-client-ts/sokoban-play-board';
import { TWO_CRATES } from '@libs/sokoban-client-ts/sokoban-player.example';
import { decodeSokobanBoard } from '@libs/sokoban-shared-ts/sokoban-definition';
import { initialSokobanPosition } from '@libs/sokoban-shared-ts/sokoban-position';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { fireEvent } from '@solidjs/testing-library';

function warehouse() {
  const level = decodeSokobanBoard(TWO_CRATES);
  if (!level.valid) throw new Error('Invalid two-crate level');
  const start = initialSokobanPosition(level.value);
  if (!start.valid) throw new Error('Invalid starting position');
  const moves: (string | number)[] = [];
  const view = renderWithI18n(() => (
    <SokobanPlayBoard
      board={level.value}
      position={start.value}
      describedBy="instructions"
      onDirection={(direction) => moves.push(direction)}
      onTile={(index) => moves.push(index)}
    />
  ));
  const board = view.getByTestId('sokoban-board');
  board.getBoundingClientRect = () => new DOMRect(0, 0, 350, 300);
  function pointer(type: string, id: number, x: number, time = 0) {
    const event = new PointerEvent(type, {
      pointerId: id,
      clientX: x,
      clientY: 175,
      button: 0,
      bubbles: true,
    });
    Object.defineProperty(event, 'timeStamp', { value: time });
    fireEvent(board, event);
  }
  return { board, pointer, moves };
}

test('a second finger owns the rest of the gesture, including a cancelled pinch and the remaining finger release', () => {
  const { board, pointer, moves } = warehouse();
  pointer('pointerdown', 1, 125);
  pointer('pointermove', 1, 155);
  pointer('pointerdown', 2, 220);
  pointer('pointermove', 2, 285);
  expect(board.dataset['magnified']).toBe('true');
  pointer('pointercancel', 2, 285);
  pointer('pointermove', 1, 40);
  pointer('pointerup', 1, 40);
  expect(moves).toEqual([]);
  fireEvent.keyDown(board, { key: '0' });
  pointer('pointerdown', 3, 30);
  pointer('pointerup', 3, 90);
  expect(moves).toEqual(['right']);
});

test('holding with one pointer zooms about the contact, tapping uses the transformed square, and a second hold fits', () => {
  const { board, pointer, moves } = warehouse();
  pointer('pointerdown', 1, 125, 10);
  pointer('pointerup', 1, 125, 610);
  expect(board.dataset['magnified']).toBe('true');
  expect(moves).toEqual([]);
  pointer('pointerdown', 1, 200, 700);
  pointer('pointerup', 1, 200, 740);
  expect(moves).toEqual([24]);
  pointer('pointerdown', 1, 120, 800);
  pointer('pointerup', 1, 120, 1400);
  expect(board.dataset['magnified']).toBe('false');
  expect(moves).toEqual([24]);
});

test('lost capture and interruption abandon pending gameplay', () => {
  const { board, pointer, moves } = warehouse();
  pointer('pointerdown', 3, 90);
  pointer('lostpointercapture', 3, 90);
  pointer('pointerup', 3, 180);
  pointer('pointerdown', 4, 90);
  fireEvent(board.ownerDocument, new Event('visibilitychange'));
  pointer('pointerup', 4, 180);
  expect(moves).toEqual([]);
});
