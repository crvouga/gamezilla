import { expect, test } from 'bun:test';
import type { ManagedSession } from '@apps/synthetic-population-worker/managed-session';
import { inspectionSchema } from '@libs/synthetic-population-shared/inspection';
import { runtimeBackend } from './runtime-backend';
import { awaitRuntimeUsers, runtimeSession } from './runtime-session';

test('native realms authenticate, mutate profiles and inspect their own complete application', async () => {
  // regression: solid-dom-concurrent-transform-cache
  // regression: synthetic-population-headless-object-store
  // regression: synthetic-population-client-health-gate
  // regression: synthetic-population-event-context-encoded
  // regression: synthetic-population-gameplay-requires-development-probe
  const backend = await runtimeBackend(2);
  const sessions: ManagedSession[] = [];
  try {
    const workerId = backend.wall.createId();
    expect(
      (
        await backend.rpc.heartbeat.$post({
          json: {
            workerId,
            version: 'realm-test',
            capacity: 2,
            draining: false,
            memoryBytes: null,
            cpuMilliseconds: null,
            leaseFailures: 0,
          },
        })
      ).status
    ).toBe(200);
    const realms = await Promise.all(
      [0, 1].map(async () => {
        const realm = await runtimeSession(backend, workerId);
        sessions.push(realm.session);
        await realm.authenticated;
        return realm;
      })
    );
    let users = await awaitRuntimeUsers(backend, (users) =>
      users.every(
        (user) => user.account_id !== null && user.checkpoint !== null
      )
    );
    expect(users.map((user) => user.id).sort()).toEqual(
      realms.map((realm) => realm.assignment.lease.userId).sort()
    );
    expect(new Set(users.map((user) => user.account_id)).size).toBe(2);
    for (const user of users) {
      expect(user.last_error).toBeNull();
      await backend.administration.command(
        user.id,
        { operationId: backend.wall.createId(), command: 'inspect' },
        workerId
      );
    }
    await Promise.all(sessions.map((session) => session.renew(false)));
    users = await awaitRuntimeUsers(backend, (users) =>
      users.every((user) => user.inspection !== null)
    );
    for (const realm of realms) {
      const user = users.find(
        (user) => user.id === realm.assignment.lease.userId
      )!;
      const snapshot = inspectionSchema.parse(user.inspection);
      expect(snapshot.generation).toBe(realm.assignment.lease.generation);
      expect(snapshot.html).not.toContain(realm.assignment.password);
      expect(snapshot.html).not.toContain(realm.assignment.email);
      expect(
        snapshot.actions.some((action) =>
          action.action.includes('profile-username-save')
        )
      ).toBe(true);
      expect(snapshot.controls.length).toBeGreaterThan(0);
    }
    expect(inspectionSchema.parse(users[0]!.inspection).html).not.toBe(
      inspectionSchema.parse(users[1]!.inspection).html
    );
    users = await awaitRuntimeUsers(backend, (users) =>
      users.every((user) => user.activity === 'playing')
    );
    for (const user of users) expect(user.last_error).toBeNull();
    for (const user of users)
      await backend.administration.command(
        user.id,
        { operationId: backend.wall.createId(), command: 'inspect' },
        workerId
      );
    await Promise.all(sessions.map((session) => session.renew(false)));
    const playing = await awaitRuntimeUsers(backend, (users) =>
      users.every((user) =>
        inspectionSchema
          .parse(user.inspection)
          .html.includes('multiplayer-game')
      )
    );
    const boards = playing.map((user) => {
      const doc = new DOMParser().parseFromString(
        inspectionSchema.parse(user.inspection).html,
        'text/html'
      );
      expect(
        doc.querySelector('[data-testid="multiplayer-board-probe"]')
      ).toBeNull();
      const board = doc.querySelector('[data-testid="multiplayer-game"]');
      return {
        interactive: board?.getAttribute('data-can-move') === 'true',
        fen: board?.getAttribute('data-fen'),
        offline:
          doc.querySelector('[data-testid="multiplayer-offline"]') !== null,
      };
    });
    expect(boards).toContainEqual(
      expect.objectContaining({ interactive: true, offline: false })
    );
    await awaitRuntimeUsers(backend, async (users) => {
      const events = await Promise.all(
        users.map((user) => backend.repository.events(user.id))
      );
      return events.every(
        (timeline) =>
          timeline.some((event) => event.event === 'MoveSubmitted') &&
          timeline.some(
            (event) =>
              event.event === 'StateTransition' &&
              typeof event.context === 'object' &&
              event.context !== null &&
              'action' in event.context &&
              event.context.action === 'ACKNOWLEDGED'
          )
      );
    });
  } finally {
    for (const session of sessions) session.abort();
    await backend.close();
  }
}, 60_000);
