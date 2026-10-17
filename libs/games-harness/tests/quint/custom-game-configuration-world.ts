import {
  customGameAcknowledgementTip,
  rememberCustomGameAcknowledgement,
} from '@libs/game-session-harness/custom-game-acknowledgement';
import { readCustomGameIdentity } from '@libs/game-session-harness/custom-game-identity';
import {
  configureCustomGameChoice,
  readCustomGameProbe,
} from '@libs/game-session-harness/custom-game-ui';
import {
  openCustomGames,
  waitCustomGameAvailability,
} from '@libs/game-session-harness/game-navigation';
import type { CustomGameInput } from '@libs/game-session-shared/custom-game-choice';
import {
  returnToTabs,
  signInWithGoogle,
  signInWithGoogleAsAccount,
} from '@libs/harness/auth-actions';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import { focusActor } from '@libs/harness/shell-actions';
import {
  createSpace,
  joinViaLink,
  reopenSpaceLink,
} from '@libs/spaces-harness/space-actions';
import {
  activeSpaceVisible,
  readSpaceLink,
} from '@libs/spaces-harness/spaces-ui-reads';
import { modelGameOf } from './model-game';

export const CONFIGURATION_DEVICES = [
  'alice',
  'bob',
  'carol',
  'alice-other',
] as const;

export function configurationPerson(
  w: QuintHarnessWorld,
  person: string
): string {
  const identities = w.memo.get('configuration-identities') as Map<
    string,
    string
  >;
  return identities.get(person === 'alice-other' ? 'alice' : person) ?? person;
}

export function configurationName(
  w: QuintHarnessWorld,
  identity: string
): string {
  if (identity === '') return '';
  const identities = w.memo.get('configuration-identities') as Map<
    string,
    string
  >;
  for (const [name, id] of identities) if (id === identity) return name;
  throw new Error(`Unrecognised visible custom game participant ${identity}`);
}

export function configurationLink(w: QuintHarnessWorld): string {
  return String(w.memo.get('custom-link'));
}

export function configurationSpaceId(w: QuintHarnessWorld): string {
  return configurationLink(w).split('/space/')[1] ?? '';
}

/** `actor` comes to the trace game's custom games in the space they are shown. */
export async function openConfiguration(
  w: QuintHarnessWorld,
  actor: string
): Promise<void> {
  await w.s.apply(openCustomGames, actor, modelGameOf(w).shared.id);
}

/** Whether `actor` is told the host is offline instead of being shown the game. */
export async function hostOfflineFor(
  w: QuintHarnessWorld,
  actor: string
): Promise<boolean> {
  return (
    (await w.s.read(
      waitCustomGameAvailability,
      actor,
      modelGameOf(w).shared.id
    )) === 'host offline'
  );
}

export async function reopenConfiguration(
  w: QuintHarnessWorld,
  actor: string
): Promise<void> {
  const members = w.memo.get('configuration-members') as Set<string>;
  const signedOut = w.memo.get('configuration-signed-out') as Set<string>;
  if (
    members.has(actor === 'alice-other' ? 'alice' : actor) &&
    !signedOut.has(actor)
  ) {
    await w.s.apply(reopenSpaceLink, actor, configurationLink(w));
    if (await hostOfflineFor(w, actor)) return;
    await openConfiguration(w, actor);
    if (!(w.memo.get('configuration-offline') as Set<string>).has(actor))
      await w.s.until(
        async (s) => (await readCustomGameProbe(s, actor))?.connected === true,
        { maxMs: 15_000 }
      );
  }
}

/** A choice the trace's beginning relies on, acknowledged before the next. */
async function fact(
  w: QuintHarnessWorld,
  actor: string,
  input: CustomGameInput
): Promise<void> {
  const game = (await w.s.read(readCustomGameProbe, actor))?.current;
  const choice = {
    ...input,
    gameId: game?.id ?? null,
    revision: game?.revision ?? 0,
  };
  const spaceId = configurationSpaceId(w);
  const before = await w.quiet.read(customGameAcknowledgementTip, spaceId);
  await w.s.apply(configureCustomGameChoice, actor, input);
  await w.s.read(rememberCustomGameAcknowledgement, spaceId, choice, before);
}

/** Alice's space at the game's custom games, with Bob and her other device in it. */
async function configurationSpace(w: QuintHarnessWorld): Promise<void> {
  await w.s.apply(focusActor, 'alice');
  if (!(await w.s.read(activeSpaceVisible, 'alice')))
    await w.s.apply(createSpace, 'alice');
  const link = await w.s.read(readSpaceLink, 'alice');
  if (link === null) throw new Error('alice has no space link');
  w.memo.set('custom-link', link);
  await openConfiguration(w, 'alice');
  for (const other of ['bob', 'alice-other']) {
    await w.s.apply(focusActor, other);
    await w.s.apply(joinViaLink, other, link);
    await openConfiguration(w, other);
  }
}

export async function prepareConfiguration(
  w: QuintHarnessWorld,
  beginning: string
): Promise<void> {
  const identities = new Map<string, string>();
  for (const actor of ['alice', 'bob', 'carol']) {
    await w.s.apply(signInWithGoogle, actor);
    await w.s.apply(returnToTabs, actor);
    identities.set(actor, await w.s.read(readCustomGameIdentity, actor));
  }
  await w.s.apply(signInWithGoogleAsAccount, 'alice-other', 'alice');
  await w.s.apply(returnToTabs, 'alice-other');
  w.memo.set('configuration-identities', identities);
  w.memo.set(
    'configuration-refusals',
    new Map(CONFIGURATION_DEVICES.map((actor) => [actor, '']))
  );
  w.memo.set('configuration-members', new Set(['alice', 'bob']));
  w.memo.set('configuration-signed-out', new Set());
  w.memo.set('configuration-offline', new Set());
  await configurationSpace(w);
  if (beginning !== 'empty') await fact(w, 'alice', { operation: 'create' });
  if (beginning === 'bots') {
    await fact(w, 'alice', { operation: 'bot', side: 'white' });
    await fact(w, 'alice', { operation: 'bot', side: 'black' });
  }
  if (['people', 'playing', 'offering'].includes(beginning)) {
    await fact(w, 'bob', { operation: 'claim', side: 'black' });
    await fact(w, 'alice', { operation: 'ready' });
    await fact(w, 'bob', { operation: 'ready' });
  }
  if (beginning === 'playing' || beginning === 'offering')
    await fact(w, 'alice', { operation: 'start' });
  if (beginning === 'offering') await fact(w, 'alice', { operation: 'offer' });
  const probe = await w.s.read(readCustomGameProbe, 'alice');
  if (probe === null) throw new Error('The host has no custom game picture');
  for (const actor of ['alice', 'bob', 'alice-other'])
    await w.s.until(
      async (s) => (await readCustomGameProbe(s, actor))?.connected === true,
      { maxMs: 5000 }
    );
}
