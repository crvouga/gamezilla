import { scenarioAction } from '@libs/harness-ts/actor-ui';

/** The trusted room-host transition, independent of any person's connection. */
export const setGameSessionAvailability = scenarioAction({
  name: 'setGameSessionAvailability',
  act: async (s, spaceId: string, available: boolean) => {
    await s.harness.roomNode.services.setAvailability(
      `space:${spaceId}`,
      available
    );
    await s.session.waitForIdle();
  },
});
