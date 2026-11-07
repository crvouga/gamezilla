import { expect, test } from 'bun:test';
import { PaddleCourt } from '@pkgs/ui-root-client-ts/paddle-court';
import { mustQuery, renderUi } from './render';

// regression: pong-phone-marker-legibility
// Literal 358px phone court from the reviewed 390px capture: retain the
// physical 20-unit ball and 18-unit paddle while making their marks readable.
test('phone court enlarges markers around unchanged physical centres', () => {
  renderUi(
    () => (
      <PaddleCourt
        width={1200}
        height={800}
        controlled={['first']}
        enabled={true}
        label="Court"
        instructionsId="court-help"
        testId="court"
        paddles={[{ side: 'first', x: 64, y: 400, width: 18, height: 144 }]}
        ball={{ x: 300, y: 300, size: 20 }}
        onDirection={() => undefined}
        onTarget={() => undefined}
        onRelease={() => undefined}
      />
    ),
    { width: 390, height: 844 }
  );
  const ball = mustQuery('[data-testid="court-ball"]');
  const paddle = mustQuery('[data-testid="court-first-paddle"]');
  expect(ball.getAttribute('data-ball-size')).toBe('20');
  expect(ball.getAttribute('cx')).toBe('300');
  expect((Number(ball.getAttribute('r')) * 2 * 358) / 1200).toBeGreaterThan(14);
  expect((Number(paddle.getAttribute('width')) * 358) / 1200).toBeGreaterThan(
    10
  );
  expect(
    Number(paddle.getAttribute('x')) + Number(paddle.getAttribute('width')) / 2
  ).toBe(64);
  expect(paddle.getAttribute('height')).toBe('144');
});
