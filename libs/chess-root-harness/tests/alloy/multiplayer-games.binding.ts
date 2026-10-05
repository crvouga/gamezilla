import { sendMultiplayerCommand } from '@libs/chess-matchmaking-harness/multiplayer-commands';
import {
  givenOpponentSearch,
  pairChessOpponents,
} from '@libs/chess-matchmaking-harness/multiplayer-fixtures';
import { storedMultiplayerSnapshot } from '@libs/chess-matchmaking-harness/multiplayer-reads';
import { signInWithGoogle } from '@libs/harness/auth-actions';
import type { OpenHarness } from '@libs/harness/open-harness';
import { bindStructure } from '@pkgs/alloy-shared/registry';
import type { Snapshot } from '@pkgs/alloy-shared/world';
import { openHarness } from '../open-chess-harness';
import { projectMultiplayer } from './multiplayer-project';

async function gameCommand(
  s: OpenHarness,
  actor: string,
  name: string,
  args: Record<string, unknown>
) {
  await s.apply(sendMultiplayerCommand, actor, {
    name,
    args: { requestId: `${name}-${actor}-${String(args['uci'] ?? '')}`, ...args },
  });
}

async function latest(s: OpenHarness) {
  const games = (await s.read(storedMultiplayerSnapshot)).games;
  return games.find((g) => g.outcome === 'ongoing') ?? games.at(-1)!;
}

async function snapshots(): Promise<readonly Snapshot[]> {
  await using s = await openHarness('legal-multiplayer-worlds');
  const worlds: Snapshot[] = [];
  const keep = async (label: string) =>
    worlds.push(projectMultiplayer(await s.read(storedMultiplayerSnapshot), label));
  for (const actor of ['alice', 'bob', 'carol', 'dave'])
    await s.apply(signInWithGoogle, actor);
  await s.apply(givenOpponentSearch, 'alice', '5+0', 'first');
  await s.advanceTime(1);
  await s.apply(givenOpponentSearch, 'bob', '5+0', 'first');
  await s.apply(pairChessOpponents, 'alice', true);
  await keep('one complete game');
  const first = await latest(s);
  for (const [actor, uci, revision] of [
    ['alice', 'e2e4', 0],
    ['bob', 'e7e5', 1],
  ] as const)
    await gameCommand(s, actor, 'playMultiplayerMove', {
      gameId: first.id,
      revision,
      uci,
    });
  if ((await latest(s)).revision !== 2)
    throw new Error('The real opening moves were not accepted');
  await keep('both first moves accepted');
  await gameCommand(s, 'bob', 'resignMultiplayer', { gameId: first.id });
  if ((await latest(s)).outcome !== 'white')
    throw new Error('The real resignation was not accepted');
  await keep('one honest result');
  await gameCommand(s, 'bob', 'offerMultiplayerRematch', { gameId: first.id });
  await gameCommand(s, 'alice', 'acceptMultiplayerRematch', { gameId: first.id });
  if ((await latest(s)).rematch_of !== first.id)
    throw new Error('The real rematch was not accepted');
  await keep('a rematch with swapped colours at the same time control');
  await s.apply(givenOpponentSearch, 'carol', '3+2', 'first');
  await s.advanceTime(1);
  await s.apply(givenOpponentSearch, 'dave', '3+2', 'first');
  await s.apply(pairChessOpponents, 'carol', true);
  const third = await s.read(storedMultiplayerSnapshot);
  const aborted = third.games.find((g) => g.time_control === '3+2')!;
  await gameCommand(s, 'carol', 'abortMultiplayer', { gameId: aborted.id });
  await keep('an aborted game beside a rematch');
  return worlds;
}

bindStructure({
  spec: 'multiplayer-games',
  snapshots: { 'server database': snapshots },
});
