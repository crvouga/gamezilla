import { rememberCustomGameAcknowledgement } from '@libs/chess-custom-game-harness/custom-game-acknowledgement';
import { openCustomGame } from '@libs/chess-custom-game-harness/custom-game-actions';
import { readCustomGameIdentity } from '@libs/chess-custom-game-harness/custom-game-identity';
import { readCustomGameProbe } from '@libs/chess-custom-game-harness/custom-game-ui';
import type { CustomGameInput } from '@libs/chess-custom-game-shared/custom-game-choice';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import {
  returnToTabs,
  signInWithGoogle,
  signInWithGoogleAsAccount,
} from '@libs/harness/auth-actions';
import { reopenSpaceLink } from '@libs/spaces-harness/space-actions';
import { customFact, customSpace } from '../steps/custom-game-world';

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
  throw new Error(`Unrecognised visible Custom Game participant ${identity}`);
}

export function configurationLink(w: QuintHarnessWorld): string {
  return String(w.memo.get('custom-link'));
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
    await w.s.apply(openCustomGame, actor);
    if (!(w.memo.get('configuration-offline') as Set<string>).has(actor))
      await w.s.until(
        async (s) => (await readCustomGameProbe(s, actor))?.connected === true,
        { maxMs: 15_000 }
      );
  }
}

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
  await customFact(w, actor, input);
  await w.s.read(
    rememberCustomGameAcknowledgement,
    configurationLink(w).split('/space/')[1] ?? '',
    choice
  );
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
  await customSpace(w, 'alice', ['bob', 'alice-other']);
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
  if (probe === null) throw new Error('Host has no Custom Game picture');
}
