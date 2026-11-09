import { expect, test } from 'bun:test';
import { screen } from '@solidjs/testing-library';
import { mountBoard } from './board-fixture';

// regression: chess-check-and-side-guidance
test('a checked black king has visible check, orientation and keyboard guidance', () => {
  const board = mountBoard({
    fen: 'rnbqkbnr/ppp2ppp/8/1B1pp3/4P3/8/PPPP1PPP/RNBQK1NR b KQkq - 1 3',
    orientation: 'black',
    showGuidance: true,
    interactive: true,
  });
  expect(screen.getByText(/Black pieces at the bottom/).textContent).toContain(
    'Black is in check.'
  );
  expect(screen.getByText(/Escape to cancel/)).toBeTruthy();
  board.setOrientation('white');
  expect(screen.getByText(/White pieces at the bottom/).textContent).toContain(
    'Black is in check.'
  );
});

// regression: chess-checkmate-told-as-check
test('a finished position names checkmate or stalemate, never plain check', () => {
  const mated = mountBoard({
    fen: 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3',
    showGuidance: true,
    interactive: false,
  });
  const matedLine = screen.getByText(/White pieces at the bottom/).textContent;
  expect(matedLine).toContain('White is checkmated.');
  expect(matedLine).not.toContain('in check');
  mated.unmount();
  const stalemated = mountBoard({
    fen: '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1',
    showGuidance: true,
    interactive: false,
  });
  expect(screen.getByText(/White pieces at the bottom/).textContent).toContain(
    'Black is stalemated.'
  );
  stalemated.unmount();
});

// regression: chess-phone-keyboard-paragraph
test('touch guidance keeps keyboard grammar behind a discoverable disclosure', () => {
  const board = mountBoard({ showGuidance: true, interactive: true });
  expect(screen.getByText('Tap a piece, then a square.')).toBeTruthy();
  const summary = screen.getByText('Keyboard controls');
  const disclosure = summary.closest('details');
  expect(disclosure?.open).toBe(false);
  expect(disclosure?.textContent).toContain('Escape to cancel.');
  board.unmount();
});

// regression: chess-guidance-placement-contract-proof-missing
test('before placement keeps keyboard guidance ahead of the same playable board', () => {
  const board = mountBoard({
    showGuidance: true,
    showCoordinates: true,
    coordinatePlacement: 'outside-start',
    guidancePlacement: 'before',
  });
  try {
    const frame = board.host.closest('[data-component="ChessBoardFrame"]');
    const help = frame?.parentElement?.querySelector('details');
    if (!frame || !help)
      throw new Error('Missing board frame or keyboard help');
    expect(
      frame.compareDocumentPosition(help) & Node.DOCUMENT_POSITION_PRECEDING
    ).not.toBe(0);
    help.open = true;
    expect(board.host.closest('[data-component="ChessBoardFrame"]')).toBe(
      frame
    );
    expect(board.host.querySelectorAll('button[data-square]').length).toBe(64);
  } finally {
    board.unmount();
  }
});
