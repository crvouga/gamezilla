import { expect, test } from 'bun:test';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { winPongPoint } from '@libs/pong-harness-ts/pong-actions';

/**
 * Alice's court at 1 to 0 with a target of 2. The deciding point lands as
 * the paddles are guided: the finished board takes both paddle controls
 * away, so the guide finds none.
 */
function courtWhoseFinalPointLandsMidGuide(): ProductHarness {
  let finished = false;
  const attributes: Record<string, Record<string, string>> = {
    'custom-game-board-ball': {
      'data-ball-size': '20',
      'data-ball-x': '500',
      'data-ball-y': '300',
    },
    'custom-game-board-drawing': { viewBox: '0 0 1000 600' },
    'custom-game-board-first-paddle': { x: '20', width: '10' },
    'custom-game-board-second-paddle': { x: '970', width: '10' },
  };
  const node = (id: string) => ({
    expect: { visible: () => Promise.resolve() },
    isVisible: () => Promise.resolve(!(finished && id.endsWith('-control'))),
    layout: () => Promise.resolve(null),
    text: () =>
      Promise.resolve(
        {
          'custom-game-board-status': finished ? 'Left wins' : 'Playing',
          'custom-game-board-score-left': `Left ${finished ? 2 : 1}`,
          'custom-game-board-score-right': 'Right 0',
          'custom-game-board-target': 'First to 2',
        }[id] ?? ''
      ),
    attribute: (name: string) =>
      Promise.resolve(
        id === 'custom-game-board-status'
          ? name === 'data-stage'
            ? finished
              ? 'finished'
              : 'playing'
            : name === 'data-winner' && finished
              ? 'left'
              : null
          : (attributes[id]?.[name] ?? null)
      ),
    input: () => {
      if (!id.endsWith('-control')) return Promise.resolve();
      finished = true;
      return Promise.reject(
        new Error(
          `node ${id} input: Timed out after 5000ms waiting for testId("${id}") wait "visible"`
        )
      );
    },
  });
  return {
    actors: new Map([['alice', { ui: { get: node } }]]),
    session: {
      scheduler: { virtual: true, starvedAdvances: () => 0 },
      advanceTime: () => Promise.resolve(),
      waitForIdle: () => Promise.resolve(),
    },
  } as never;
}

// regression: pong-final-point-removes-paddle-controls
test('the final point taking the paddle controls away is that point, not a failure', async () => {
  await expect(
    Promise.resolve(
      winPongPoint.act(courtWhoseFinalPointLandsMidGuide(), 'left')
    )
  ).resolves.toBeUndefined();
});
