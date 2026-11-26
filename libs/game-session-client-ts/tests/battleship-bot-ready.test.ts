import { expect, test } from 'bun:test';
import { useCustomGameChoices } from '@libs/game-session-client-ts/use-custom-game-choices';
import {
  type CustomGameChoice,
  customGameChoiceSchema,
} from '@libs/game-session-shared-ts/custom-game-choice';
import {
  type CustomGame,
  newCustomGame,
} from '@libs/game-session-shared-ts/custom-game-state';
import { createMemo, createRoot, createSignal } from 'solid-js';

// regression: battleship-bot-ready-empty-fleet
test('Play a bot confirms the generated fleet even before the draft repaints', async () => {
  const gameId = '2fd7f12e-9c66-437c-a3af-6d7259e5d9c0';
  const fleet =
    'fleet:carrier@a1h;battleship@a3h;cruiser@a5h;submarine@a7h;destroyer@a9h';
  const reported = {
    operation: 'ready',
    setup: '',
    gameId,
    revision: 1,
  } satisfies CustomGameChoice;
  expect(customGameChoiceSchema.safeParse(reported).success).toBe(false);
  const sent: CustomGameChoice[] = [];
  let current: CustomGame | null = null;
  const { choices, dispose } = createRoot((dispose) => {
    const [arranged, setArranged] = createSignal('');
    const draft = createMemo(() => arranged());
    return {
      dispose,
      choices: useCustomGameChoices({
        current: () => current,
        gameId: () => 'private-setup-game',
        spaceId: () => 'space',
        privateSetup: {
          has: () => true,
          draft,
          complete: () => draft() === fleet,
          random: () => {
            setArranged(fleet);
            return fleet;
          },
        },
        send: async (choice) => {
          sent.push(choice);
          if (choice.operation === 'create')
            current = newCustomGame(gameId, 'alice', 'initial');
          if (choice.operation === 'bot' && current)
            current = { ...current, revision: 1 };
          return gameId;
        },
      }),
    };
  });
  try {
    await choices.playBot();
    expect(sent.find((choice) => choice.operation === 'ready')).toEqual({
      ...reported,
      setup: fleet,
    });
    expect(sent.at(-1)?.operation).toBe('start');
  } finally {
    dispose();
  }
});
