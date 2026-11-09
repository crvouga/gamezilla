import { expect, fireEvent, userEvent, within } from 'storybook/test';
import { numberlinkGeometry } from './numberlink-geometry.example';

/** Synthetic touch events exercise production hit testing; capture itself needs a trusted browser pointer. */
export async function recoverWithPointer(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  // regression: numberlink-recovery-displaces-undo
  const undoTop = await numberlinkGeometry(canvasElement);
  const board = canvas.getByTestId('numberlink-board');
  const capture = board.setPointerCapture;
  const release = board.releasePointerCapture;
  board.setPointerCapture = () => undefined;
  board.releasePointerCapture = () => undefined;
  const point = (cell: number) => {
    const box = board.getBoundingClientRect();
    return {
      clientX: box.left + (((cell % 5) + 0.5) * box.width) / 5,
      clientY: box.top + ((Math.floor(cell / 5) + 0.5) * box.height) / 5,
      pointerId: 1,
      pointerType: 'touch',
      isPrimary: true,
      button: 0,
      buttons: 1,
    };
  };
  const draw = async (cells: number[], cancel = false) => {
    const start = cells[0];
    if (start === undefined) throw new Error('Missing start');
    await fireEvent.pointerDown(board, point(start));
    for (const cell of cells.slice(1))
      await fireEvent.pointerMove(board, point(cell));
    const end = cells.at(-1) ?? start;
    if (cancel) await fireEvent.pointerCancel(board, point(end));
    else await fireEvent.pointerUp(board, point(end));
  };
  try {
    // regression: numberlink-phone-path-recovery-undiscoverable
    await userEvent.click(
      canvas.getByRole('button', { name: 'Drawing and keyboard help' })
    );
    await expect(
      canvas.getByText(/Start again at an endpoint to redraw/)
    ).toBeInTheDocument();
    await userEvent.click(
      canvas.getByRole('button', { name: 'Drawing and keyboard help' })
    );
    await draw([0, 1, 2], true);
    await expect(
      canvas.getByRole('button', { name: 'B1: empty' })
    ).toBeInTheDocument();
    await draw([0, 1, 2, 1]);
    await expect(
      canvas.getByRole('button', { name: 'B1: path 1, unfinished' })
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: 'C1: empty' })
    ).toBeInTheDocument();
    await draw([0, 1, 2, 3, 8, 13]);
    await expect(
      canvas.getByRole('button', { name: 'A1: endpoint 1, connected' })
    ).toBeInTheDocument();
    await expect(await numberlinkGeometry(canvasElement)).toBe(undoTop);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Remove a path' })
    );
    await userEvent.click(
      within(document.body).getByRole('option', { name: 'Remove path 1' })
    );
    await expect(
      canvas.getByRole('button', { name: 'B1: empty' })
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: 'A1: endpoint 1, unfinished' })
    ).toBeInTheDocument();
    await draw([0, 1, 2, 3, 8, 13]);
    await expect(
      canvas.getByRole('button', { name: 'D3: endpoint 1, connected' })
    ).toBeInTheDocument();
  } finally {
    board.setPointerCapture = capture;
    board.releasePointerCapture = release;
  }
}
