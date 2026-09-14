import {
  createPointerSession,
  MOUSE_DRAG_THRESHOLD_PX,
  TOUCH_DRAG_THRESHOLD_PX,
} from '@pkgs/chess-board/pointer-session';
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
    canDrag: (_sq: string) => owns,
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
  it('keeps an owned mouse press below the threshold as a tap', () => {
    const interaction = fakeInteraction();
    const session = createPointerSession(interaction as never);
    session.down('e2', 100, 100, 'mouse');
    expect(session.state().kind).toBe('press');
    expect(interaction.getSnapshot().dragFrom).toBeNull();
    session.move(100 + MOUSE_DRAG_THRESHOLD_PX - 1, 100);
    expect(session.state().kind).toBe('press');
    session.up('e2');
    expect(interaction.tap).toHaveBeenCalledWith('e2');
    expect(session.state().kind).toBe('idle');
  });

  it('promotes mouse drag after crossing the mouse threshold then drops', () => {
    const interaction = fakeInteraction();
    const session = createPointerSession(interaction as never);
    session.down('e2', 100, 100, 'mouse');
    expect(session.move(100 + MOUSE_DRAG_THRESHOLD_PX + 1, 100)).toBe(true);
    expect(session.state().kind).toBe('drag');
    expect(interaction.getSnapshot().dragFrom).toBe('e2');
    session.up('e4');
    expect(interaction.drop).toHaveBeenCalledWith('e2', 'e4');
  });

  it('uses a larger threshold for touch pointers', () => {
    const interaction = fakeInteraction();
    const session = createPointerSession(interaction as never);
    session.down('e2', 100, 100, 'touch');
    expect(session.move(100 + MOUSE_DRAG_THRESHOLD_PX + 1, 100)).toBe(false);
    expect(session.state().kind).toBe('press');
    expect(session.move(100 + TOUCH_DRAG_THRESHOLD_PX + 1, 100)).toBe(true);
    expect(session.state().kind).toBe('drag');
  });

  it('degrades same-square drag release to a tap', () => {
    const interaction = fakeInteraction();
    const session = createPointerSession(interaction as never);
    session.down('e2', 10, 10, 'mouse');
    session.move(10 + MOUSE_DRAG_THRESHOLD_PX + 1, 10);
    session.up('e2');
    expect(interaction.tap).toHaveBeenCalledWith('e2');
    expect(session.state().kind).toBe('idle');
  });

  it('taps non-owned presses on release', () => {
    const interaction = fakeInteraction(false);
    const session = createPointerSession(interaction as never);
    session.down('e7', 0, 0, 'mouse');
    expect(session.state().kind).toBe('press');
    session.up('e7');
    expect(interaction.tap).toHaveBeenCalledWith('e7');
  });
});
