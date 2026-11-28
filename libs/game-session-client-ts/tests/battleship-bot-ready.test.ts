import { expect, test } from 'bun:test';
import { useGameSessionChoices } from '@libs/game-session-client-ts/use-game-session-choices';
import {
  type GameSessionChoice,
  gameSessionChoiceSchema,
} from '@libs/game-session-shared-ts/game-session-choice';
import {
  type GameSession,
  newGameSession,
} from '@libs/game-session-shared-ts/game-session-state';
import { createMemo, createRoot, createSignal } from 'solid-js';

// regression: battleship-bot-ready-empty-fleet
test('Bot setup waits for an arranged fleet before confirming readiness', async () => {
  const gameId = '2fd7f12e-9c66-437c-a3af-6d7259e5d9c0';
  const fleet =
    'fleet:carrier@a1h;battleship@a3h;cruiser@a5h;submarine@a7h;destroyer@a9h';
  const reported = {
    operation: 'ready',
    setup: '',
    gameId,
    revision: 1,
  } satisfies GameSessionChoice;
  expect(gameSessionChoiceSchema.safeParse(reported).success).toBe(false);
  const sent: GameSessionChoice[] = [];
  let current: GameSession | null = null;
  const { choices, dispose, arrange } = createRoot((dispose) => {
    const [arranged, setArranged] = createSignal('');
    const draft = createMemo(() => arranged());
    return {
      dispose,
      arrange: () => setArranged(fleet),
      choices: useGameSessionChoices({
        current: () => current,
        gameId: () => 'private-setup-game',
        privateSetup: {
          has: () => true,
          draft,
          complete: () => draft() === fleet,
        },
        send: async (choice) => {
          sent.push(choice);
          if (choice.operation === 'create')
            current = newGameSession({
              id: gameId,
              creator: 'alice',
              position: 'initial',
            });
          if (choice.operation === 'bot' && current)
            current = { ...current, revision: 1 };
          return gameId;
        },
      }),
    };
  });
  try {
    await choices.choose({ operation: 'create', mode: 'vs-bot' });
    await choices.ready();
    expect(sent.map((choice) => choice.operation)).toEqual(['create']);
    arrange();
    await Promise.resolve();
    await choices.ready();
    expect(sent.find((choice) => choice.operation === 'ready')).toEqual({
      ...reported,
      revision: 0,
      setup: fleet,
    });
    expect(sent.at(-1)?.operation).toBe('ready');
  } finally {
    dispose();
  }
});
