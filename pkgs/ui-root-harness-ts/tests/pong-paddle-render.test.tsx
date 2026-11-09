import { afterEach, expect, test } from 'bun:test';
import { PaddleCourt } from '@pkgs/ui-root-client-ts/paddle-court';
import { cleanup } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { renderUi } from './render';

afterEach(cleanup);

// regression: pong-frame-recreates-paddle-nodes
test('Pong position updates retain paddle elements while repainting geometry', () => {
  const [y, setY] = createSignal(400);
  const view = renderUi(() => (
    <PaddleCourt
      width={1200}
      height={800}
      controlled={['first']}
      enabled
      label="Pong court"
      instructionsId="pong-help"
      testId="pong"
      paddles={[
        { side: 'first', x: 64, y: y(), width: 18, height: 144 },
        { side: 'second', x: 1136, y: 800 - y(), width: 18, height: 144 },
      ]}
      ball={{ x: 600, y: 400, size: 20 }}
      onDirection={() => undefined}
      onTarget={() => undefined}
      onRelease={() => undefined}
    />
  ));
  const left = view.getByTestId('pong-first-paddle');
  const right = view.getByTestId('pong-second-paddle');
  for (let frame = 1; frame <= 120; frame++) {
    setY(400 + frame);
    expect(view.getByTestId('pong-first-paddle') === left).toBe(true);
    expect(view.getByTestId('pong-second-paddle') === right).toBe(true);
    expect(left.getAttribute('y')).toBe(String(328 + frame));
    expect(right.getAttribute('y')).toBe(String(328 - frame));
  }
});
