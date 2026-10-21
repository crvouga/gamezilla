import { exportPreparationConsumer } from '@libs/account-privacy-server/privacy-consumers';
import { prepareExport } from '@libs/account-privacy-shared/messages';
import { drainAndNotifyOutbox } from '@libs/app-root-server/outbox-drain';
import {
  actorUi,
  ensureActor,
  pollUntil,
  scenarioAction,
} from '@libs/harness/actor-ui';
import {
  signInWithGoogle,
  signInWithGoogleAsAccount,
  signOut,
} from '@libs/harness/auth-actions';
import {
  signedInAccountOf as readAccount,
  signedInAccountOf,
} from '@libs/harness/identity';
import { failNextHarnessObjectWrite } from '@libs/harness/mockingbird-object-store';
import { partitioned } from '@libs/harness/observations';
import { openAccount } from '@libs/harness/shell-actions';
import { OutboxConsumerRegistry } from '@pkgs/outbox-shared/define-consumer';
import sql from '@pkgs/sql-root-shared/sql';

export const proveAccount = scenarioAction({
  name: 'proveAccount',
  act: async (s, actor: string, person: string = actor) => {
    await ensureActor(s, actor);
    if ((await signedInAccountOf(s, actor)) !== null) {
      await Promise.resolve(openAccount.act(s, actor));
      await Promise.resolve(signOut.act(s, actor));
    }
    if (person === actor) await Promise.resolve(signInWithGoogle.act(s, actor));
    else await Promise.resolve(signInWithGoogleAsAccount.act(s, actor, person));
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
    await Promise.resolve(openPrivacy.act(s, actor));
    await (await actorUi(s, actor)).get('privacy-delete-review').tap();
  },
});

export const confirmDeletion = scenarioAction({
  name: 'confirmDeletion',
  act: async (s, actor: string) => {
    await ensureActor(s, actor);
    const ui = await actorUi(s, actor);
    // A confirmation already open is confirmed as it stands.
    if (!(await ui.get('privacy-delete-confirm').isVisible()))
      await Promise.resolve(reviewDeletion.act(s, actor));
    if (!(await ui.get('privacy-delete-confirm').isVisible())) return;
    await ui.get('privacy-delete-confirm').tap();
    await pollUntil(
      s,
      async () => {
        if (await ui.get('privacy-deletion-outcome').isVisible()) return true;
        if (
          !(await ui.get('privacy-delete-modal').isVisible()) &&
          (await ui.get('privacy-delete-denial').isVisible())
        )
          return true;
        const modal = (await ui.get('privacy-delete-modal').isVisible())
          ? await ui.get('privacy-delete-modal').text()
          : null;
        return modal?.includes('failed') || modal?.includes('Try again')
          ? true
          : null;
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
    await Promise.resolve(openPrivacy.act(s, actor));
    await (await actorUi(s, actor)).get('privacy-export-request').tap();
    await s.session.waitForIdle();
  },
});

/** Answer the warning before a ready export is replaced: ask for a new one. */
export const confirmExportReplacement = scenarioAction({
  name: 'confirmExportReplacement',
  act: async (s, actor: string) => {
    const ui = await actorUi(s, actor);
    await ui.get('privacy-export-replace-confirm').tap();
    await s.session.waitForIdle();
  },
});

/**
 * Ask for an export and see the request through: a ready export's
 * replacement warning is answered by asking for the new one.
 */
export const requestExport = scenarioAction({
  name: 'requestExport',
  act: async (s, actor: string) => {
    await Promise.resolve(askForExport.act(s, actor));
    const ui = await actorUi(s, actor);
    if (await ui.get('privacy-export-replace-confirm').isVisible())
      await Promise.resolve(confirmExportReplacement.act(s, actor));
  },
});

export const runPrivacyJobs = scenarioAction({
  name: 'runPrivacyJobs',
  act: async (
    s,
    prepareExports: boolean = true,
    eventIds?: readonly string[]
  ) => {
    const consumerRegistry = new OutboxConsumerRegistry();
    for (const consumer of s.harness.outboxConsumers().all()) {
      if (prepareExports || consumer.id !== 'profile-prepare-export')
        consumerRegistry.register(consumer);
    }
    if (
      prepareExports &&
      consumerRegistry.get('profile-prepare-export') === undefined
    )
      consumerRegistry.register(
        exportPreparationConsumer(
          s.harness.composition.app.accountPrivacy,
          s.harness.roomNode.services
        )
      );
    await drainAndNotifyOutbox({
      db: s.harness.serverSql.sqlClient,
      clock: s.harness.clock,
      createId: s.session.ports.createId,
      pubsub: s.harness.server.events,
      objectStore: s.harness.server.blob,
      consumerRegistry,
      ...(eventIds === undefined ? {} : { eventIds }),
    });
    for (const actor of s.actors.keys()) {
      if (partitioned(s).some((pair) => pair.split('|').includes(actor)))
        continue;
      const env = await s.harness.client(actor);
      await env.createAuthClient(env.server).session.refresh();
    }
  },
});

/** Resume the world after an absence; overdue work wakes once, as on a sleeping device. */
export const privacyTimePasses = scenarioAction({
  name: 'privacyTimePasses',
  act: async (s, ms: number, prepareExports: boolean = true) => {
    await s.session.waitForIdle();
    await s.session.scheduler.underlying.sleep(Math.max(0, ms - 2_000));
    await s.session.advanceTime(Math.min(ms, 2_000));
    await Promise.resolve(runPrivacyJobs.act(s, prepareExports));
  },
});

export const completeExport = scenarioAction({
  name: 'completeExport',
  act: async (s, actor: string, fail: boolean = false) => {
    const accountId = await readAccount(s, actor);
    const events = await s.harness.serverSql.sqlClient.query(
      sql<{
        id: string;
        payload: unknown;
      }>`SELECT id, payload FROM outbox_events WHERE type = ${prepareExport.type} AND deleted_at IS NULL`
    );
    const eventIds = events
      .filter((event) => {
        const payload =
          typeof event.payload === 'string'
            ? JSON.parse(event.payload)
            : event.payload;
        return (
          payload !== null &&
          typeof payload === 'object' &&
          'accountId' in payload &&
          payload.accountId === accountId
        );
      })
      .map((event) => event.id);
    if (fail) {
      failNextHarnessObjectWrite(s.harness.server.blob);
    }
    await s.session.advanceTime(1_001);
    await Promise.resolve(runPrivacyJobs.act(s, true, eventIds));
    await s.session.waitForIdle();
    await Promise.resolve(openPrivacy.act(s, actor));
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
