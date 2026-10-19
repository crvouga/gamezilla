import { establishCustomGame } from '@libs/game-session-harness/custom-game-lineup';
import { readCustomGameProbe } from '@libs/game-session-harness/custom-game-probe';
import { readStoredCustomGameWorld } from '@libs/game-session-harness/custom-game-stored';
import { configureCustomGameChoice } from '@libs/game-session-harness/custom-game-ui';
import type { HarnessGame } from '@libs/game-session-harness/harness-game';
import type { CustomGameInput } from '@libs/game-session-shared/custom-game-choice';
import { readSpaceLink } from '@libs/spaces-harness/spaces-ui-reads';
import { bindStructure } from '@pkgs/alloy-shared/registry';
import type { Snapshot } from '@pkgs/alloy-shared/world';
import { gamesHeldTo, openConformanceHarness } from '../conformance-world';
import { projectCustomGames } from './custom-games-projection';

/** The stored worlds one game's custom games pass through, each labelled for it. */
async function customGameWorlds(game: HarnessGame): Promise<Snapshot[]> {
  await using s = await openConformanceHarness(
    `alloy-custom-games-${game.shared.id}`
  );
  const snapshots: Snapshot[] = [];
  const choose = (actor: string, input: CustomGameInput) =>
    s.apply(configureCustomGameChoice, actor, input);
  const capture = async (label: string) => {
    const link = await s.read(readSpaceLink, 'alice');
    const spaceId = link?.split('/space/')[1] ?? '';
    snapshots.push(
      projectCustomGames(
        await s.read(readStoredCustomGameWorld, spaceId),
        `${label} [${game.label}]`
      )
    );
  };
  await s.apply(establishCustomGame, game.shared.id, {
    host: 'alice',
    first: 'alice',
    second: 'bob',
    ready: false,
    active: false,
  });
  await capture('two people choosing their custom game');
  await choose('alice', { operation: 'ready' });
  await choose('bob', { operation: 'ready' });
  await choose('alice', { operation: 'start' });
  await capture('two ready people playing');
  await choose('bob', { operation: 'resign' });
  await capture('a finished custom game keeps its participants');
  await choose('alice', { operation: 'create' });
  const bob = (await s.read(readCustomGameProbe, 'bob'))?.myId;
  if (!bob) throw new Error(`${game.label}: Bob sees no custom games`);
  await choose('alice', { operation: 'invite', side: 'black', person: bob });
  await capture('a waiting invitation belongs to one side');
  await choose('alice', { operation: 'cancel' });
  await capture('cancelling releases invitations');
  await choose('alice', { operation: 'create' });
  await choose('alice', { operation: 'bot', side: 'white' });
  await choose('alice', { operation: 'bot', side: 'black' });
  await choose('alice', { operation: 'start' });
  await capture('the creator watches two bots');
  await choose('alice', { operation: 'cancel' });
  return snapshots;
}

bindStructure({
  spec: 'custom-games',
  snapshots: {
    'space authority and membership, for every game': async () => {
      const snapshots: Snapshot[] = [];
      for (const game of gamesHeldTo('specs/games/custom-games.als'))
        snapshots.push(...(await customGameWorlds(game)));
      return snapshots;
    },
  },
});
