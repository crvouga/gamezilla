import { pollUntil, scenarioAction } from '@libs/harness-ts/actor-ui';
import { leaveSpace } from '@libs/spaces-harness-ts/space-actions';
import { customGameView } from './custom-game-probe';

export const leaveCustomGameSpace = scenarioAction({
  name: 'leaveCustomGameSpace',
  act: async (s, actor: string, host: string) => {
    const departing = await customGameView(s, actor);
    const gameId = departing.current?.id;
    if (!gameId || !departing.members.includes(departing.myId))
      throw new Error(`${actor} is not in the custom game's space`);
    await Promise.resolve(leaveSpace.act(s, actor));
    // The Leave confirmation can close before the host receives the departure.
    await pollUntil(
      s,
      async () => {
        const seen = await customGameView(s, host);
        return seen.connected &&
          seen.current?.id === gameId &&
          seen.members.includes(seen.myId) &&
          !seen.members.includes(departing.myId)
          ? true
          : null;
      },
      {
        maxMs: 20_000,
        actor: host,
        description: `${host} to receive ${actor}'s departure from the custom game's space`,
      }
    );
  },
});
