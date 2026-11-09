import { expect, test } from 'bun:test';
import { createSignal } from 'solid-js';
import { mountBoard } from './board-fixture';

// regression: chess-tablet-recovery-guidance-collapse
test('disabling input retains the guidance footprint without offering unavailable controls', () => {
  const [interactive, setInteractive] = createSignal(true);
  const board = mountBoard({
    showGuidance: true,
    guidancePlacement: 'after',
    get interactive() {
      return interactive();
    },
  });
  try {
    const row =
      board.host.parentElement?.querySelector('details')?.parentElement;
    if (!row) throw new Error('Missing guidance row');
    setInteractive(false);
    expect(row.isConnected).toBe(true);
    expect(row.getAttribute('aria-hidden')).toBe('true');
    expect(row.hasAttribute('inert')).toBe(true);
    expect(row.classList.contains('invisible')).toBe(true);
    setInteractive(true);
    expect(row.getAttribute('aria-hidden')).toBe('false');
    expect(row.hasAttribute('inert')).toBe(false);
    expect(row.classList.contains('invisible')).toBe(false);
  } finally {
    board.unmount();
  }
});
