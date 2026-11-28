import { expect, spyOn, test } from 'bun:test';
import meta, { LiveRally } from '@libs/pong-client-ts/pong-board-view.stories';
import { i18n } from '@lingui/core';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { fireEvent } from '@solidjs/testing-library';
import { flush } from 'solid-js';

function playUntilPoint(layout: { width: number; height: number }): void {
  let nextFrame: FrameRequestCallback | undefined;
  const request = spyOn(globalThis, 'requestAnimationFrame').mockImplementation(
    (callback) => {
      nextFrame = callback;
      return 1;
    }
  );
  const clock = spyOn(performance, 'now').mockReturnValue(0);
  const frame = (time: number) => {
    if (!nextFrame) throw new Error('The Pong rally stopped');
    nextFrame(time);
    flush();
  };
  const view = renderWithI18n(() => (
    <ThemeProvider colorScheme="light" fixedLayout={layout}>
      {LiveRally.render(meta.args, { parameters: meta.parameters })}
    </ThemeProvider>
  ));
  const format = spyOn(i18n, '_');
  try {
    const court = view.getByRole('application', { name: 'Pong court' });
    const ball = view.getByTestId('game-session-board-ball');
    const paddle = view.getByTestId('game-session-board-first-paddle');
    const near = view.getByTestId('game-session-white');
    const far = view.getByTestId('game-session-black');
    const portraits = () =>
      ['white', 'black'].map((side) =>
        view.getByTestId(`game-session-${side}`).querySelector('img')
      );
    const beforePoint = portraits();
    expect(beforePoint.every((image) => image !== null)).toBe(true);
    const courtScore = view.getByTestId('game-session-board-court-score-first');
    expect(courtScore.textContent).toBe('0');
    const initialScores = [near.textContent, far.textContent];
    fireEvent.keyDown(court, { key: 'ArrowDown' });
    frame(20);
    const before = [ball.getAttribute('cx'), paddle.getAttribute('y')];
    format.mockClear();
    frame(40);
    expect(ball.getAttribute('cx')).not.toBe(before[0]);
    expect(paddle.getAttribute('y')).not.toBe(before[1]);
    expect([near.textContent, far.textContent]).toEqual(initialScores);
    expect(format.mock.calls).toHaveLength(0);
    fireEvent.keyUp(court, { key: 'ArrowDown' });
    for (let time = 240; time <= 10_040; time += 200) {
      frame(time);
      if (
        near.textContent !== initialScores[0] ||
        far.textContent !== initialScores[1]
      )
        break;
    }
    expect([near.textContent, far.textContent]).not.toEqual(initialScores);
    expect(courtScore.textContent).toBe('1');
    expect(
      portraits().every((image, side) => image === beforePoint[side])
    ).toBe(true);
    expect(view.getByTestId('game-session-board-status').textContent).toContain(
      'scored'
    );
  } finally {
    view.unmount();
    format.mockRestore();
    clock.mockRestore();
    request.mockRestore();
  }
}

// regression: pong-live-rally-rebuilds-table-on-ball-motion
// regression: pong-rally-rebuilds-controls-and-avatar
test.each([
  { width: 390, height: 844 },
  { width: 844, height: 390 },
])(
  'a live rally at $width by $height moves the paddle and updates the score in place',
  playUntilPoint
);
