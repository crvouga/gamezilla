import { afterEach, expect, spyOn, test } from 'bun:test';
import { PongBoard } from '@libs/pong-client-ts/pong-board';
import { pongConfig } from '@libs/pong-shared-ts/pong-config';
import { pongPositionCodec } from '@libs/pong-shared-ts/pong-game';
import { initialPongState } from '@libs/pong-shared-ts/pong-state';
import { i18n } from '@lingui/core';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

afterEach(cleanup);

// regression: pong-status-reformatted-every-frame
test('the court status is formatted once per change of its words, not once per frame', () => {
  const config = pongConfig();
  const start = initialPongState(config, () => 0);
  const [position, setPosition] = createSignal(pongPositionCodec.encode(start));
  const view = renderWithI18n(() => (
    <ThemeProvider
      colorScheme="light"
      fixedLayout={{ width: 390, height: 844 }}
    >
      <PongBoard
        position={position()}
        orientation="white"
        interactive={true}
        sound={false}
        syncKey={0}
        testId="pong"
        setup={null}
        hand={null}
        committed={[]}
        commitment={null}
        onAction={() => {
          throw new Error('Pong cannot emit a discrete move');
        }}
        simulation={{
          paused: false,
          stale: false,
          sides: ['white'],
          onInput: () => {},
          onRelease: () => {},
        }}
      />
    </ThemeProvider>
  ));
  const format = spyOn(i18n, '_');
  const serves = () =>
    format.mock.calls.filter((call) =>
      JSON.stringify(call).includes('Serve in')
    ).length;
  // Thirty frames inside one countdown second: only the paddles move.
  for (let frame = 1; frame <= 30; frame++)
    setPosition(
      pongPositionCodec.encode({
        ...start,
        paddles: {
          ...start.paddles,
          left: { ...start.paddles.left, y: start.paddles.left.y + frame },
        },
      })
    );
  const seconds = Math.ceil(start.countdown / config.tickRate);
  expect(view.getByText(`Serve in ${seconds}`)).toBeDefined();
  expect(serves()).toBeLessThanOrEqual(1);
  // The next countdown second still rewords it.
  setPosition(
    pongPositionCodec.encode({
      ...start,
      countdown: start.countdown - config.tickRate,
    })
  );
  expect(view.getByText(`Serve in ${seconds - 1}`)).toBeDefined();
  format.mockRestore();
});
