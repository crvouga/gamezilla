/** @jsxImportSource solid-js */
import { expect, test } from 'bun:test';
import { PaddleCourt } from '@pkgs/ui-root-client-ts/paddle-court';
import { mustQuery, renderUi } from './render';

// regression: pong-ball-drawn-size-breaks-court-reads — the ball became a
// larger circle than it plays, and readers of the court (the Pong harness)
// lost its position; the ball now carries its played position and size.
test('the court ball carries where and how large it plays, apart from its drawn size', () => {
  renderUi(
    () => (
      <PaddleCourt
        width={1200}
        height={800}
        controlled={[]}
        enabled={false}
        label="Court"
        instructionsId="court-help"
        testId="court"
        paddles={[]}
        ball={{ x: 700, y: 300, size: 20 }}
        onDirection={() => undefined}
        onTarget={() => undefined}
        onRelease={() => undefined}
      />
    ),
    { width: 1200, height: 900 }
  );
  const ball = mustQuery('[data-testid="court-ball"]');
  expect(ball.getAttribute('data-ball-x')).toBe('700');
  expect(ball.getAttribute('data-ball-y')).toBe('300');
  expect(ball.getAttribute('data-ball-size')).toBe('20');
});
