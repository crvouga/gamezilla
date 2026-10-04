import {
  askForExport,
  completeExport,
  confirmDeletion,
  openExportAddress,
  privacyTimePasses,
  proveAccount,
  runPrivacyJobs,
} from '@libs/account-privacy-harness/privacy-actions';
import { privacyStatus } from '@libs/account-privacy-harness/privacy-reads';
import { partition, restoreActorConnection } from '@libs/harness/actions';
import { signedInAccountOf } from '@libs/harness/identity';
import { partitioned } from '@libs/harness/observations';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import { deviceShowsSignedIn } from '@libs/harness/sign-in-state-reads';
import { profileVisibleToPeople } from '@libs/profile-harness/profile-visibility';
import type { QuintValue } from '@pkgs/quint-shared/itf';
import { variant } from '@pkgs/quint-shared/itf';
import type { Picks } from '@pkgs/quint-shared/registry';
import { bindQuintModel } from '@pkgs/quint-shared/registry';

const PEOPLE = ['alice', 'bob'] as const;
const DEVICES = ['alice-phone', 'alice-computer', 'bob-phone'] as const;
const ACTORS: Readonly<Record<string, string>> = {
  'alice-phone': 'alice',
  'alice-computer': 'alice_phone',
  'bob-phone': 'bob',
};
function actor(p: Picks) {
  const actor = ACTORS[String(p['d'])];
  if (actor === undefined) throw new Error('Unknown privacy device');
  return actor;
}
function account(w: QuintHarnessWorld, person: string) {
  const id = w.memo.get(`account:${person}`);
  if (typeof id !== 'string') throw new Error('Privacy account missing');
  return id;
}

bindQuintModel<QuintHarnessWorld>({
  model: 'account-privacy',
  traces: 16,
  maxSteps: 20,
  actions: {
    init: async (w) => {
      for (const person of PEOPLE) {
        await w.s.apply(proveAccount, person);
        w.memo.set(
          `account:${person}`,
          await w.s.read(signedInAccountOf, person)
        );
      }
      await w.s.apply(proveAccount, 'alice_phone', 'alice');
    },
    proveAccount: (w, p) =>
      w.s.apply(
        proveAccount,
        actor(p),
        actor(p) === 'alice_phone' ? 'alice' : actor(p)
      ),
    confirmDeletion: async (w, p) => {
      await w.s.apply(confirmDeletion, actor(p));
      await w.s.apply(runPrivacyJobs, false);
    },
    requestExport: (w, p) => w.s.apply(askForExport, actor(p)),
    exportReady: (w, p) => w.s.apply(completeExport, String(p['p'])),
    exportFails: (w, p) => w.s.apply(completeExport, String(p['p']), true),
    downloadExport: (w, p) =>
      w.s.apply(openExportAddress, actor(p), account(w, String(p['p']))),
    loseConnection: async (w, p) => {
      await w.s.apply(partition, actor(p));
      await w.s.advanceTime(1_000);
    },
    connectionReturns: async (w, p) => {
      await w.s.apply(restoreActorConnection, actor(p));
      await w.s.advanceTime(2_000);
      await w.s.apply(runPrivacyJobs, false);
    },
    _timePasses: (w, p) =>
      w.s.apply(privacyTimePasses, Number(p['elapsed']) * 60_000, false),
  },
  observe: async (w) => {
    const deletion = new Map<QuintValue, QuintValue>();
    const exports = new Map<QuintValue, QuintValue>();
    const profilesShown = new Set<QuintValue>();
    const retained = new Set<QuintValue>();
    const signedIn = new Set<QuintValue>();
    const offline = new Set<QuintValue>();
    for (const person of PEOPLE) {
      const state = await w.quiet.read(privacyStatus, account(w, person));
      deletion.set(person, variant(state.deletion));
      exports.set(person, variant(state.exportStage));
      if (
        (await w.quiet.read(profileVisibleToPeople, account(w, person))) !==
        null
      )
        profilesShown.add(person);
      if (state.ordinaryDataRetained) retained.add(person);
    }
    const cuts = await w.quiet.read(partitioned);
    for (const device of DEVICES) {
      const deviceActor = ACTORS[device];
      if (deviceActor === undefined) throw new Error('Privacy device missing');
      if (await w.quiet.read(deviceShowsSignedIn, deviceActor))
        signedIn.add(device);
      if (cuts.some((pair) => pair.split('|').includes(deviceActor)))
        offline.add(device);
    }
    return { deletion, exports, profilesShown, retained, signedIn, offline };
  },
});
