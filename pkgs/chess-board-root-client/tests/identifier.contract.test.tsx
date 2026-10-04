/** @jsxImportSource solid-js */
import { expect, test } from 'bun:test';
import { renderWithI18n } from '@pkgs/bun-test-solid-client/render';
import {
  chessBoardProbeTestId,
  chessBoardSquareTestId,
  parseChessBoardProbe,
} from '@pkgs/chess-board-core-shared/probe';
import type { Move } from '@pkgs/chess-board-core-shared/types';
import { ChessBoard } from '@pkgs/chess-board-root-client/chess-board';
import { ClockProvider } from '@pkgs/clock-client/solid';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import { AudioPlaybackProvider } from '@pkgs/sounds-client/solid';
import { ThemeProvider } from '@pkgs/ui-root-client/theme-context';
import { Chess } from 'chess.js';
import { noopAudio } from './board-fixture';

test('a custom public identifier scopes square controls, probe and move output', () => {
  const id = 'other-board';
  const { clock, timers } = createHarnessClock();
  const moves: Move[] = [];
  const { container } = renderWithI18n(() => (
    <ClockProvider clock={clock} timers={timers}>
      <ThemeProvider colorScheme="light">
        <AudioPlaybackProvider value={noopAudio()}>
          <ChessBoard
            size={320}
            animations={false}
            sound={false}
            dataSet={{ testid: id }}
            onMove={(move) => moves.push(move)}
          />
        </AudioPlaybackProvider>
      </ThemeProvider>
    </ClockProvider>
  ));
  for (const square of ['e2', 'e4'] as const) {
    const node = container.querySelector<HTMLElement>(
      `[data-testid="${chessBoardSquareTestId(id, square)}"]`
    );
    if (node === null) throw new Error('Missing custom square identifier');
    node.focus();
    node.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' })
    );
  }
  const raw = container.querySelector(
    `[data-testid="${chessBoardProbeTestId(id)}"]`
  )?.textContent;
  const oracle = new Chess();
  oracle.move('e4');
  expect(parseChessBoardProbe(raw ?? null).fen).toBe(oracle.fen());
  expect(moves).toHaveLength(1);
  expect(moves[0]).toMatchObject({
    from: 'e2',
    to: 'e4',
    san: 'e4',
  });
  expect(container.querySelectorAll('[data-piece-square]')).toHaveLength(32);
});
