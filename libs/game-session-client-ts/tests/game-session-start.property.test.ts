import { expect, test } from 'bun:test';
import { useGameSessionChoices } from '@libs/game-session-client-ts/use-game-session-choices';
import type { GameSessionChoice } from '@libs/game-session-shared-ts/game-session-choice';
import {
  type GameSession,
  newGameSession,
} from '@libs/game-session-shared-ts/game-session-state';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { createMemo, createRoot } from 'solid-js';

type Change = 'session' | 'title' | 'space' | 'close' | 'none';

async function startAcrossChange(changeAfter: number, change: Change) {
  const created = newGameSession({
    id: 'created',
    creator: 'alice',
    position: 'initial',
  });
  let current: GameSession | null = null;
  let title = 'first-game';
  const sent: GameSessionChoice[] = [];
  const { choices, dispose } = createRoot((close) => {
    const changes = {
      session: () => {
        current = { ...created, id: 'winner' };
      },
      title: () => {
        title = 'second-game';
      },
      space: close,
      close,
      none: () => undefined,
    };
    return {
      dispose: close,
      choices: useGameSessionChoices({
        current: () => current,
        gameId: () => title,
        privateSetup: {
          has: () => false,
          draft: createMemo(() => ''),
          complete: () => true,
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
    await Promise.all([
      choices.choose({ operation: 'create', mode: 'vs-bot' }),
      choices.choose({ operation: 'create', mode: 'vs-bot' }),
    ]);
    return sent;
  } finally {
    dispose();
  }
}

test('repeated bot starts only configure the session their create opened', async () => {
  await assertProperty(
    'bot starts stay in their game and space across delayed answers',
    fc.asyncProperty(
      fc.integer({ min: 0, max: 3 }),
      fc.constantFrom<Change>('session', 'title', 'space', 'close', 'none'),
      async (changeAfter, change) => {
        const sent = await startAcrossChange(changeAfter, change);
        expect(sent).toEqual([
          {
            operation: 'create',
            mode: 'vs-bot',
            game: 'first-game',
            gameId: null,
            revision: 0,
          },
        ]);
      }
    )
  );
});
