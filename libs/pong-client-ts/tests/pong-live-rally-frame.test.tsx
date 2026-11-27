import { expect, spyOn, test } from 'bun:test';
import meta, { LiveRally } from '@libs/pong-client-ts/pong-board-view.stories';
import { i18n } from '@lingui/core';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { fireEvent } from '@solidjs/testing-library';
import { flush } from 'solid-js';

// regression: pong-live-rally-rebuilds-table-on-ball-motion
test('the 390px live rally moves the ball and paddle without rewording the table until a point', () => {
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
    <ThemeProvider
      colorScheme="light"
      fixedLayout={{ width: 390, height: 844 }}
    >
      {LiveRally.render(meta.args, { parameters: meta.parameters })}
    </ThemeProvider>
  ));
  const format = spyOn(i18n, '_');
  try {
    const court = view.getByRole('application', { name: 'Pong court' });
    const ball = view.getByTestId('custom-game-board-ball');
    const paddle = view.getByTestId('custom-game-board-first-paddle');
    const near = view.getByTestId('custom-game-white');
    const far = view.getByTestId('custom-game-black');
    const initialScores = [near.textContent, far.textContent];
    fireEvent.keyDown(court, { key: 'ArrowDown' });
    frame(20);
    const before = [ball.getAttribute('cx'), paddle.getAttribute('y')];
    format.mockClear();
    frame(40);
    expect(ball.getAttribute('cx')).not.toBe(before[0]);
    expect(paddle.getAttribute('y')).not.toBe(before[1]);
    expect([near.textContent, far.textContent]).toEqual(initialScores);
    expect(
      format.mock.calls.filter(([message]) =>
        /Drag or use the arrow keys|"Points"/.test(JSON.stringify(message))
      )
    ).toHaveLength(0);
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
    expect(view.getByTestId('custom-game-board-status').textContent).toContain(
      'scored'
    );
  } finally {
    view.unmount();
    format.mockRestore();
    clock.mockRestore();
    request.mockRestore();
  }
});
