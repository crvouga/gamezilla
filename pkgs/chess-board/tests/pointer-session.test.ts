import { createPointerSession } from '@pkgs/chess-board/pointer-session';
import { describe, expect, it, vi } from 'vitest';

function fakeInteraction(owns = true) {
  let selected: string | null = null;
  let dragFrom: string | null = null;
  return {
    getSnapshot: () => ({
      interactive: true,
      selected,
      dragFrom,
      pendingPromotion: null,
      legalTargets: [] as const,
    }),
    beginDrag: (sq: string) => {
      if (!owns) return false;
      dragFrom = sq;
      selected = null;
      return true;
    },
    cancelDrag: () => {
      dragFrom = null;
    },
    drop: vi.fn((from: string, to: string) => {
      dragFrom = null;
      return { kind: 'applied' as const, result: { from, to } };
    }),
    tap: vi.fn((sq: string) => {
      selected = selected === sq ? null : sq;
    }),
  };
}

describe('createPointerSession', () => {
  it('degrades same-square drag release to a tap', () => {
    const interaction = fakeInteraction();
    const session = createPointerSession(interaction as never);
    session.down('e2');
    expect(session.state().kind).toBe('drag');
    session.up('e2');
    expect(interaction.tap).toHaveBeenCalledWith('e2');
    expect(session.state().kind).toBe('idle');
  });

  it('drops onto a different square', () => {
    const interaction = fakeInteraction();
    const session = createPointerSession(interaction as never);
    session.down('e2');
    session.up('e4');
    expect(interaction.drop).toHaveBeenCalledWith('e2', 'e4');
  });

  it('taps non-owned presses on release', () => {
    const interaction = fakeInteraction(false);
    const session = createPointerSession(interaction as never);
    session.down('e7');
    expect(session.state().kind).toBe('press');
    session.up('e7');
    expect(interaction.tap).toHaveBeenCalledWith('e7');
  });
});
