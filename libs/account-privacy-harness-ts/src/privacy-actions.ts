import { exportPreparationConsumer } from '@libs/account-privacy-server-ts/privacy-consumers';
import { prepareExport } from '@libs/account-privacy-shared-ts/messages';
import { drainAndNotifyOutbox } from '@libs/app-root-server-ts/outbox-drain';
import { requireVirtualTime, sleepThroughTime } from '@libs/harness-ts/actions';
import {
  actorUi,
  ensureActor,
  pollUntil,
  scenarioAction,
} from '@libs/harness-ts/actor-ui';
import {
  signInWithGoogle,
  signInWithGoogleAsAccount,
  signOut,
} from '@libs/harness-ts/auth-actions';
import type { ProductHarness } from '@libs/harness-ts/harness';
import {
  signedInAccountOf as readAccount,
  signedInAccountOf,
} from '@libs/harness-ts/identity';
import { failNextHarnessObjectWrite } from '@libs/harness-ts/mockingbird-object-store';
import { partitioned } from '@libs/harness-ts/observations';
import { openAccount } from '@libs/harness-ts/shell-actions';
import { OutboxConsumerRegistry } from '@pkgs/outbox-shared-ts/define-consumer';
import sql from '@pkgs/sql-root-shared-ts/sql';

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
    // Opening the screen also serves signed-out people reading a deletion receipt.
    // The destructive action is permission-gated and is not a readiness marker.
    await handle.ui.get('privacy-deletion-task').expect.visible();
  },
});

export const reviewDeletion = scenarioAction({
  name: 'reviewDeletion',
  act: async (s, actor: string) => {
    await Promise.resolve(openPrivacy.act(s, actor));
    await choosePrivacyControl(
      s,
      actor,
      'privacy-delete-review',
      'privacy-delete-access'
    );
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
    await choosePrivacyControl(
      s,
      actor,
      'privacy-export-request',
      'privacy-export-access'
    );
    await s.session.waitForIdle();
  },
});

/** A policy refusal replaces the action; observe it without inventing a click. */
async function choosePrivacyControl(
  s: ProductHarness,
  actor: string,
  control: string,
  denial: string
): Promise<void> {
  const ui = await actorUi(s, actor);
  const available = await pollUntil(
    s,
    async () => {
      if (await ui.get(control).isVisible()) return 'allowed';
      if (await ui.get(denial).isVisible()) return 'denied';
      return null;
    },
    { maxMs: 5_000, description: `${control} or its permission explanation` }
  );
  if (available === 'allowed') await ui.get(control).tap();
}

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

/**
 * Minutes go by while a sign-in ages or a confirmation stays open. A host on
 * the wall clock would sit through them for real, past the scenario's
 * deadline, so it ends the scenario at a host limit instead.
 */
export const proofAges = scenarioAction({
  name: 'proofAges',
  act: async (s, ms: number) => {
    requireVirtualTime(s);
    await s.session.advanceTime(ms);
  },
});

/** Resume the world after an absence; overdue work wakes once, as on a sleeping device. */
export const privacyTimePasses = scenarioAction({
  name: 'privacyTimePasses',
  act: async (s, ms: number, prepareExports: boolean = true) => {
    requireVirtualTime(s);
    await s.session.waitForIdle();
    await sleepThroughTime(s, Math.max(0, ms - 2_000));
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
