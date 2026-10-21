import { readCustomGameTime } from '@libs/game-session-harness-ts/custom-game-clocks';
import { playCustomGameHistory } from '@libs/game-session-harness-ts/custom-game-history';
import { readCustomGameProbe } from '@libs/game-session-harness-ts/custom-game-probe';
import { readStoredCustomGames } from '@libs/game-session-harness-ts/custom-game-stored';
import { customGameTimeLeft } from '@libs/game-session-shared-ts/custom-game-state';
import { restartApp } from '@libs/harness-ts/actions';
import {
  returnToTabs,
  signInWithGoogleAsAccount,
  signOut,
} from '@libs/harness-ts/auth-actions';
import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import { openAccount } from '@libs/harness-ts/shell-actions';
import {
  openProfileEdit,
  submitUsername,
} from '@libs/profile-harness-ts/profile-actions';
import { joinViaLink, leaveSpace } from '@libs/spaces-harness-ts/space-actions';
import { spaceHostOfflineShown } from '@libs/spaces-harness-ts/spaces-ui-reads';
import {
  configurationTurn,
  onVictoryLine,
} from './custom-game-configuration-play';
import {
  configurationLink,
  configurationName,
  configurationSpaceId,
  hostOfflineFor,
  openConfiguration,
  reopenConfiguration,
} from './custom-game-configuration-world';
import { modelGameOf, productSide, victoryOf } from './model-game';

export async function configurationLeaves(
  w: QuintHarnessWorld,
  actor: string
): Promise<void> {
  const device = (w.memo.get('configuration-signed-out') as Set<string>).has(
    actor
  )
    ? await remoteAccountDevice(w, actor)
    : actor;
  if (device !== actor) {
    await w.s.apply(joinViaLink, device, configurationLink(w));
    if (!(await w.s.read(spaceHostOfflineShown, device)))
      await openConfiguration(w, device);
  } else await reopenConfiguration(w, device);
  await w.s.apply(leaveSpace, device);
  const person = actor === 'alice-other' ? 'alice' : actor;
  const members = w.memo.get('configuration-members') as Set<string>;
  if (person === 'alice') members.clear();
  else members.delete(person);
}

export async function configurationJoins(
  w: QuintHarnessWorld,
  actor: string
): Promise<void> {
  const device = (w.memo.get('configuration-signed-out') as Set<string>).has(
    actor
  )
    ? await remoteAccountDevice(w, actor)
    : actor;
  await w.s.apply(joinViaLink, device, configurationLink(w));
  const refusals = w.memo.get('configuration-refusals') as Map<string, string>;
  if (await hostOfflineFor(w, device)) {
    refusals.set(actor, 'the host is offline');
    return;
  }
  await openConfiguration(w, device);
  await w.s.until(
    async (s) => (await readCustomGameProbe(s, device))?.connected === true,
    { maxMs: 15_000 }
  );
  (w.memo.get('configuration-members') as Set<string>).add(
    actor === 'alice-other' ? 'alice' : actor
  );
  refusals.set(actor, '');
}

export async function configurationSignsOut(
  w: QuintHarnessWorld,
  actor: string
): Promise<void> {
  await w.s.apply(openAccount, actor);
  await w.s.apply(signOut, actor);
  (w.memo.get('configuration-signed-out') as Set<string>).add(actor);
}

export async function configurationSignsIn(
  w: QuintHarnessWorld,
  actor: string
): Promise<void> {
  await w.s.apply(
    signInWithGoogleAsAccount,
    actor,
    actor === 'alice-other' ? 'alice' : actor
  );
  (w.memo.get('configuration-signed-out') as Set<string>).delete(actor);
  await reopenConfiguration(w, actor);
}

export async function configurationReopens(
  w: QuintHarnessWorld,
  actor: string
): Promise<void> {
  await w.s.apply(restartApp, actor);
  await reopenConfiguration(w, actor);
}

export async function configurationRenames(
  w: QuintHarnessWorld,
  actor: string
): Promise<void> {
  // A signed-out device keeps its last picture. Renaming needs a signed-in
  // device, and signing one in would show the game again.
  if ((w.memo.get('configuration-signed-out') as Set<string>).has(actor))
    return;
  const device = await remoteAccountDevice(w, actor);
  await w.s.apply(openProfileEdit, device);
  await w.s.apply(
    submitUsername,
    device,
    `renamed_${Number(w.memo.get('configuration-remote-devices'))}`
  );
}

async function remoteAccountDevice(
  w: QuintHarnessWorld,
  actor: string
): Promise<string> {
  const person = actor === 'alice-other' ? 'alice' : actor;
  const count = Number(w.memo.get('configuration-remote-devices') ?? 0) + 1;
  w.memo.set('configuration-remote-devices', count);
  const device = `account-${person}-${count}`;
  await w.s.apply(signInWithGoogleAsAccount, device, person);
  await w.s.apply(returnToTabs, device);
  return device;
}

/**
 * `_finishGame`: the first side's winning move by the game's rules, or a
 * side running out of time. The model abstracts the moves away: a victory
 * plays the rest of the first side's known victory, whose first moves are
 * the custom game's so far (both sides are people, so every move followed
 * it); running out of time first brings the losing side to move.
 */
export async function finishConfiguration(
  w: QuintHarnessWorld,
  result: string
): Promise<void> {
  const spaceId = configurationSpaceId(w);
  const game = (await w.s.read(readStoredCustomGames, spaceId)).current;
  if (game === null)
    throw new Error('No custom game under way for the model to finish');
  const devices = {
    white: configurationName(w, game.white.person),
    black: configurationName(w, game.black.person),
  };
  if (result.endsWith('on time')) {
    const loser = productSide(result.startsWith('first') ? 'second' : 'first');
    await configurationTurn(w, loser, devices);
    const now = await w.s.read(readCustomGameTime);
    const current = (await w.s.read(readStoredCustomGames, spaceId)).current;
    if (current === null) throw new Error('The custom game disappeared');
    await w.s.advanceTime(customGameTimeLeft(current, loser, now));
    return;
  }
  if (!onVictoryLine(w, game))
    throw new Error(
      `${modelGameOf(w).label}: the custom game left the first side's victory, so the model cannot finish it by the game's rules`
    );
  await w.s.apply(playCustomGameHistory, {
    spaceId,
    ...devices,
    moves: victoryOf(modelGameOf(w)).slice(game.moves.length),
  });
}
