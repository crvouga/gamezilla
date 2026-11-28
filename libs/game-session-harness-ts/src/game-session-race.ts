import { DEVICE_ID_KEY } from '@libs/auth-shared-ts/auth-storage-keys';
import type { GameSessionChoice } from '@libs/game-session-shared-ts/game-session-choice';
import { ChangeGameSession } from '@libs/game-session-shared-ts/game-session-commands';
import { scenarioAction } from '@libs/harness-ts/actor-ui';
import { answerOfRoomCommand } from '@libs/spaces-harness-ts/room-command-probe';
import { readGameSessionIdentity } from './game-session-identity';

/** Send every prepared choice before waiting for any one room answer. */
export const raceGameSessionChoices = scenarioAction({
  name: 'raceGameSessionChoices',
  act: async (
    s,
    args: {
      spaceId: string;
      choices: readonly { actor: string; choice: GameSessionChoice }[];
    }
  ) => {
    const prepared = await Promise.all(
      args.choices.map(async (attempt) => ({
        attempt,
        env: await s.harness.client(attempt.actor),
        identity: await readGameSessionIdentity(s, attempt.actor),
      }))
    );
    await Promise.all(
      prepared.map(async ({ attempt, env, identity }) => {
        const installId = env.secureStorage.getValue(DEVICE_ID_KEY);
        if (installId === null)
          throw new Error('racing device has no identity');
        await answerOfRoomCommand(s.harness.roomNode, {
          spaceId: args.spaceId,
          identity,
          installId,
          payload: ChangeGameSession(attempt.choice),
          commandId: env.createId(),
          nowMs: s.harness.clock.now(),
          clock: env.clock,
          timers: env.timers,
        });
      })
    );
    await s.session.advanceTime(0);
  },
});
