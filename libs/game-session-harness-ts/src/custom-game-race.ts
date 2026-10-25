import { DEVICE_ID_KEY } from '@libs/auth-shared-ts/auth-storage-keys';
import type { CustomGameChoice } from '@libs/game-session-shared-ts/custom-game-choice';
import { ChangeCustomGame } from '@libs/game-session-shared-ts/custom-game-commands';
import { scenarioAction } from '@libs/harness-ts/actor-ui';
import { answerOfRoomCommand } from '@libs/spaces-harness-ts/room-command-probe';
import { readCustomGameIdentity } from './custom-game-identity';

/** Send every prepared choice before waiting for any one room answer. */
export const raceCustomGameChoices = scenarioAction({
  name: 'raceCustomGameChoices',
  act: async (
    s,
    args: {
      spaceId: string;
      choices: readonly { actor: string; choice: CustomGameChoice }[];
    }
  ) => {
    const prepared = await Promise.all(
      args.choices.map(async (attempt) => ({
        attempt,
        env: await s.harness.client(attempt.actor),
        identity: await readCustomGameIdentity(s, attempt.actor),
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
          payload: ChangeCustomGame(attempt.choice),
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
