import { describe, expect, it, mock } from 'bun:test';
import {
  createPointerSession,
  MOUSE_DRAG_THRESHOLD_PX,
  TOUCH_DRAG_THRESHOLD_PX,
} from '@pkgs/chess-board-root-shared/pointer-session';

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
    drop: mock((from: string, to: string) => {
      dragFrom = null;
      return { kind: 'applied' as const, result: { from, to } };
    }),
    tap: mock((sq: string) => {
      selected = selected === sq ? null : sq;
    }),
  };
}

describe('createPointerSession', () => {
  it('picks an owned piece up on press, before any movement', () => {
    const interaction = fakeInteraction();
    const session = createPointerSession(interaction as never);
    session.down('e2', 100, 100, 'mouse');
    expect(session.state().kind).toBe('drag');
    expect(interaction.getSnapshot().dragFrom).toBe('e2');
  });

  it('a release before the threshold is a tap on the pressed square, wherever it lands', () => {
    const interaction = fakeInteraction();
    const session = createPointerSession(interaction as never);
    session.down('e2', 100, 100, 'mouse');
    expect(session.move(100 + MOUSE_DRAG_THRESHOLD_PX - 1, 100)).toBe(false);
    // The finger wobbled across the square edge: still a tap on e2.
    session.up('f2');
    expect(interaction.drop).not.toHaveBeenCalled();
    expect(interaction.tap).toHaveBeenCalledWith('e2');
    expect(session.state().kind).toBe('idle');
  });

  it('past the mouse threshold a release drops', () => {
    const interaction = fakeInteraction();
    const session = createPointerSession(interaction as never);
    session.down('e2', 100, 100, 'mouse');
    expect(session.move(100 + MOUSE_DRAG_THRESHOLD_PX + 1, 100)).toBe(true);
    expect(session.move(100 + MOUSE_DRAG_THRESHOLD_PX + 9, 100)).toBe(false);
    session.up('e4');
    expect(interaction.drop).toHaveBeenCalledWith('e2', 'e4');
  });

  it('uses a larger threshold for touch pointers', () => {
    const interaction = fakeInteraction();
    const session = createPointerSession(interaction as never);
    session.down('e2', 100, 100, 'touch');
    expect(session.move(100 + MOUSE_DRAG_THRESHOLD_PX + 1, 100)).toBe(false);
    session.up('e3');
    expect(interaction.drop).not.toHaveBeenCalled();
    session.down('e2', 100, 100, 'touch');
    expect(session.move(100 + TOUCH_DRAG_THRESHOLD_PX + 1, 100)).toBe(true);
    session.up('e3');
    expect(interaction.drop).toHaveBeenCalledWith('e2', 'e3');
  });

  it('a traveled drag released on its own square abandons the move', () => {
    // regression: chessboard-abandoned-drop-selection
    const interaction = fakeInteraction();
    const session = createPointerSession(interaction as never);
    session.down('e2', 10, 10, 'mouse');
    session.move(10 + MOUSE_DRAG_THRESHOLD_PX + 1, 10);
    session.up('e2');
    expect(interaction.tap).not.toHaveBeenCalled();
    expect(interaction.getSnapshot().selected).toBeNull();
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
