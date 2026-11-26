import { expect, test } from 'bun:test';
import { useCustomGameChoices } from '@libs/game-session-client-ts/use-custom-game-choices';
import type { CustomGameChoice } from '@libs/game-session-shared-ts/custom-game-choice';
import {
  type CustomGame,
  newCustomGame,
} from '@libs/game-session-shared-ts/custom-game-state';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { createMemo, createRoot } from 'solid-js';

type Change = 'session' | 'title' | 'space' | 'close' | 'none';

async function startAcrossChange(changeAfter: number, change: Change) {
  const created = newCustomGame('created', 'alice', 'initial');
  let current: CustomGame | null = null;
  let title = 'first-game';
  let space = 'first-space';
  const sent: CustomGameChoice[] = [];
  const { choices, dispose } = createRoot((close) => {
    const changes = {
      session: () => {
        current = { ...created, id: 'winner' };
      },
      title: () => {
        title = 'second-game';
      },
      space: () => {
        space = 'second-space';
      },
      close,
      none: () => undefined,
    };
    return {
      dispose: close,
      choices: useCustomGameChoices({
        current: () => current,
        gameId: () => title,
        spaceId: () => space,
        privateSetup: {
          has: () => false,
          draft: createMemo(() => ''),
          complete: () => true,
          random: () => undefined,
        },
        send: async (choice) => {
          sent.push(choice);
          await Promise.resolve();
          if (choice.operation === 'create') current = created;
          if (sent.length === changeAfter + 1) changes[change]();
          return choice.operation === 'create' ? created.id : null;
        },
      }),
    };
  });
  try {
    await Promise.all([choices.playBot(), choices.playBot()]);
    return sent;
  } finally {
    dispose();
  }
}

test('repeated bot starts only configure the session their create opened', async () => {
  const operations: CustomGameChoice['operation'][] = [
    'create',
    'bot',
    'ready',
    'start',
  ];
  await assertProperty(
    'bot starts stay in their game and space across delayed answers',
    fc.asyncProperty(
      fc.integer({ min: 0, max: 3 }),
      fc.constantFrom<Change>('session', 'title', 'space', 'close', 'none'),
      async (changeAfter, change) => {
        const sent = await startAcrossChange(changeAfter, change);
        expect(sent.map((choice) => choice.operation)).toEqual(
          change === 'none' ? operations : operations.slice(0, changeAfter + 1)
        );
        expect(
          sent.slice(1).every((choice) => choice.gameId === 'created')
        ).toBe(true);
      }
    )
  );
});
