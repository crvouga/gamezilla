import { openCustomGame } from '@libs/chess-custom-game-harness/custom-game-actions';
import { readCustomGameTime } from '@libs/chess-custom-game-harness/custom-game-clocks';
import {
  CUSTOM_GAME_FOOLS_MATE,
  CUSTOM_GAME_REPETITION,
} from '@libs/chess-custom-game-harness/custom-game-histories';
import { playCustomGameHistory } from '@libs/chess-custom-game-harness/custom-game-history';
import { waitCustomGameAvailability } from '@libs/chess-custom-game-harness/custom-game-screen';
import { readStoredCustomGames } from '@libs/chess-custom-game-harness/custom-game-stored';
import { readCustomGameProbe } from '@libs/game-session-harness/custom-game-ui';
import { customGameTimeLeft } from '@libs/game-session-shared/custom-game-state';
import { restartApp } from '@libs/harness/actions';
import {
  returnToTabs,
  signInWithGoogleAsAccount,
  signOut,
} from '@libs/harness/auth-actions';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import { openAccount } from '@libs/harness/shell-actions';
import {
  openProfileEdit,
  submitUsername,
} from '@libs/profile-harness/profile-actions';
import { joinViaLink, leaveSpace } from '@libs/spaces-harness/space-actions';
import { spaceHostOfflineShown } from '@libs/spaces-harness/spaces-ui-reads';
import { configurationTurn } from './custom-game-configuration-play';
import {
  configurationLink,
  configurationName,
  reopenConfiguration,
} from './custom-game-configuration-world';

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
      await w.s.apply(openCustomGame, device);
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
  if ((await w.s.read(waitCustomGameAvailability, device)) === 'host offline') {
    refusals.set(actor, 'the host is offline');
    return;
  }
  await w.s.apply(openCustomGame, device);
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

/** Acquire the decisive chess history; the model abstracts away its moves. */
export async function finishConfiguration(
  w: QuintHarnessWorld,
  result: string
): Promise<void> {
  const spaceId = configurationLink(w).split('/space/')[1] ?? '';
  const game = (await w.s.read(readStoredCustomGames, spaceId)).current;
  if (game === null)
    throw new Error('No active Custom Game for a chess ending');
  const devices = {
    white: configurationName(w, game.white.person),
    black: configurationName(w, game.black.person),
  };
  if (result.endsWith('on time')) {
    const loser = result.startsWith('white') ? 'black' : 'white';
    await configurationTurn(w, loser, devices);
    const now = await w.s.read(readCustomGameTime);
    const current = (await w.s.read(readStoredCustomGames, spaceId)).current;
    if (current === null) throw new Error('The Custom Game disappeared');
    await w.s.advanceTime(customGameTimeLeft(current, loser, now));
    return;
  }
  await configurationTurn(w, 'white', devices);
  const whiteMate = ['e2e4', 'f7f6', 'd2d4', 'g7g5', 'd1h5'];
  await w.s.apply(playCustomGameHistory, {
    spaceId,
    ...devices,
    moves:
      result === 'draw'
        ? CUSTOM_GAME_REPETITION
        : result.startsWith('white')
          ? whiteMate
          : CUSTOM_GAME_FOOLS_MATE,
  });
}
