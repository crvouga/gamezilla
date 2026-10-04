import { sendMultiplayerCommand } from '@libs/chess-harness/multiplayer-commands';
import { givenOpponentSearch, pairChessOpponents } from '@libs/chess-matchmaking-harness/multiplayer-fixtures';
import { storedMultiplayerSnapshot } from '@libs/chess-matchmaking-harness/multiplayer-reads';
import { signInWithGoogle } from '@libs/harness/auth-actions';
import { bindStructure } from '@pkgs/alloy-shared/registry';
import type { Snapshot } from '@pkgs/alloy-shared/world';
import { openHarness } from '../open-chess-harness';
import { projectMultiplayer } from './multiplayer-project';

async function snapshots(): Promise<readonly Snapshot[]> {
  await using s = await openHarness('legal-multiplayer-worlds');
  const worlds: Snapshot[] = [];
  for (const actor of ['alice', 'bob', 'carol', 'dave'])
    await s.apply(signInWithGoogle, actor);
  await s.apply(givenOpponentSearch, 'alice', 'first');
  await s.advanceTime(1);
  await s.apply(givenOpponentSearch, 'bob', 'first');
  await s.apply(pairChessOpponents);
  worlds.push(
    projectMultiplayer(
      await s.read(storedMultiplayerSnapshot),
      'one complete game'
    )
  );
  const first = (await s.read(storedMultiplayerSnapshot)).games[0]!;
  await s.apply(sendMultiplayerCommand, 'alice', {
    name: 'playMultiplayerMove',
    args: { gameId: first.id, revision: 0, uci: 'e2e4', requestId: 'opening' },
  });
  if ((await s.read(storedMultiplayerSnapshot)).games[0]?.revision !== 1)
    throw new Error('The real opening move was not accepted');
  worlds.push(
    projectMultiplayer(
      await s.read(storedMultiplayerSnapshot),
      'one accepted move'
    )
  );
  await s.apply(sendMultiplayerCommand, 'bob', {
    name: 'resignMultiplayer',
    args: { gameId: first.id, requestId: 'give-up' },
  });
  if ((await s.read(storedMultiplayerSnapshot)).games[0]?.outcome !== 'white')
    throw new Error('The real resignation was not accepted');
  worlds.push(
    projectMultiplayer(
      await s.read(storedMultiplayerSnapshot),
      'one honest result'
    )
  );
  await s.apply(givenOpponentSearch, 'alice', 'second');
  await s.apply(givenOpponentSearch, 'carol', 'first');
  await s.apply(pairChessOpponents);
  worlds.push(
    projectMultiplayer(
      await s.read(storedMultiplayerSnapshot),
      'a later game with a retained earlier result'
    )
  );
  return worlds;
}

bindStructure({
  spec: 'multiplayer-games',
  snapshots: { 'server database': snapshots },
});
