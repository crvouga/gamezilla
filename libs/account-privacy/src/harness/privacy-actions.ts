import {
  actorUi,
  ensureActor,
  pollUntil,
  scenarioAction,
} from '@libs/harness/system/actor-ui';
import {
  signInWithGoogle,
  signInWithGoogleAsAccount,
  signOut,
} from '@libs/harness/system/auth-actions';
import { signedInAccountOf } from '@libs/harness/system/identity';
import { openAccount } from '@libs/harness/system/shell-actions';
import { drainAndNotifyOutbox } from '@libs/server-app/sync/outbox-drain';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';

export const proveAccount = scenarioAction({
  name: 'proveAccount',
  act: async (s, actor: string, person: string = actor) => {
    await ensureActor(s, actor);
    if ((await signedInAccountOf(s, actor)) !== null) {
      await openAccount.act(s, actor);
      await signOut.act(s, actor);
    }
    if (person === actor) await signInWithGoogle.act(s, actor);
    else await signInWithGoogleAsAccount.act(s, actor, person);
  },
});

export const openPrivacy = scenarioAction({
  name: 'openPrivacy',
  act: async (s, actor: string) => {
    await ensureActor(s, actor);
    const handle = s.actors.get(actor);
    if (handle === undefined) throw new Error('Privacy actor missing');
    await handle.openLink('/profile/privacy');
    await handle.ui.get('privacy-delete-review').expect.visible();
  },
});

export const reviewDeletion = scenarioAction({
  name: 'reviewDeletion',
  act: async (s, actor: string) => {
    await openPrivacy.act(s, actor);
    await (await actorUi(s, actor)).get('privacy-delete-review').tap();
  },
});

export const confirmDeletion = scenarioAction({
  name: 'confirmDeletion',
  act: async (s, actor: string) => {
    await reviewDeletion.act(s, actor);
    const ui = await actorUi(s, actor);
    if (!(await ui.get('privacy-delete-confirm').isVisible())) return;
    await ui.get('privacy-delete-confirm').tap();
    await pollUntil(
      s,
      async () => {
        if (await ui.get('privacy-deletion-outcome').isVisible()) return true;
        const modal = (await ui.get('privacy-delete-modal').isVisible())
          ? await ui.get('privacy-delete-modal').text()
          : null;
        return modal?.includes('failed') ? true : null;
      },
      { maxMs: 20_000, description: 'account deletion outcome' }
    );
  },
});

export const cancelDeletion = scenarioAction({
  name: 'cancelDeletion',
  act: async (s, actor: string) => {
    await (await actorUi(s, actor)).key('escape');
  },
});

export const askForExport = scenarioAction({
  name: 'askForExport',
  act: async (s, actor: string) => {
    await openPrivacy.act(s, actor);
    await (await actorUi(s, actor)).get('privacy-export-request').tap();
    await s.session.waitForIdle();
  },
});

export const runPrivacyJobs = scenarioAction({
  name: 'runPrivacyJobs',
  act: async (s) => {
    await drainAndNotifyOutbox({
      db: s.harness.serverSql.sqlClient,
      clock: s.harness.clock,
      createId: s.session.ports.createId,
      pubsub: s.harness.server.events,
      objectStore: s.harness.server.blob,
    });
    for (const actor of s.actors.keys()) {
      const env = await s.harness.client(actor);
      await env.createAuthClient().session.refresh();
    }
  },
});

/** Resume the world after an absence; overdue work wakes once, as on a sleeping device. */
export const privacyTimePasses = scenarioAction({
  name: 'privacyTimePasses',
  act: async (s, ms: number) => {
    await s.session.waitForIdle();
    await s.session.scheduler.underlying.sleep(Math.max(0, ms - 2_000));
    await s.session.advanceTime(Math.min(ms, 2_000));
    await runPrivacyJobs.act(s);
  },
});

export const completeExport = scenarioAction({
  name: 'completeExport',
  act: async (s, actor: string, fail: boolean = false) => {
    if (fail) {
      const store = s.harness.server.blob;
      if (!(store instanceof ObjectStoreImplInMemory))
        throw new Error(
          'Export storage faults need the in-process storage host'
        );
      store.armFault(new Error('Export file storage unavailable'));
    }
    await s.session.advanceTime(1_001);
    await runPrivacyJobs.act(s);
    await s.session.waitForIdle();
    await openPrivacy.act(s, actor);
  },
});

export const openExportAddress = scenarioAction({
  name: 'openExportAddress',
  act: async (s, actor: string, ownerId: string) => {
    await ensureActor(s, actor);
    const handle = s.actors.get(actor);
    if (handle === undefined) throw new Error('Export actor missing');
    await handle.openLink(
      `/profile/privacy/export/${encodeURIComponent(ownerId)}`
    );
    await s.session.waitForIdle();
  },
});
