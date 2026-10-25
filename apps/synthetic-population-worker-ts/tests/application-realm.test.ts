import { expect, test } from 'bun:test';
import type { ManagedSession } from '@apps/synthetic-population-worker-ts/managed-session';
import { inspectionSchema } from '@libs/synthetic-population-shared-ts/inspection';
import { runtimeBackend } from './runtime-backend';
import { awaitRuntimeUsers, runtimeSession } from './runtime-session';

test('native realms authenticate, mutate profiles and inspect their own complete application', async () => {
  // regression: native-realms-seek-different-games
  // regression: hydrated-broker-url-never-reaches-push
  // regression: synthetic-population-offline-controller-missing
  // regression: solid-dom-concurrent-transform-cache
  // regression: synthetic-population-headless-object-store
  // regression: synthetic-population-client-health-gate
  // regression: synthetic-population-event-context-encoded
  // regression: synthetic-population-gameplay-requires-development-probe
  // regression: synthetic-native-realms-incompatible-game-pools
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
      // Each realm signed in with a link from its own inbox, and no trace of
      // the link, or of any value it carried, is left to inspect.
      expect(realm.signInLinks).toHaveLength(1);
      const inspected = JSON.stringify(snapshot);
      for (const link of realm.signInLinks) {
        expect(inspected).not.toContain(link);
        for (const value of new URL(link).searchParams.values())
          expect(inspected).not.toContain(value);
      }
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
        visible: board !== null,
        offline:
          doc.querySelector('[data-testid="multiplayer-offline"]') !== null,
      };
    });
    expect(boards).toHaveLength(2);
    expect(boards.every((board) => board.visible && !board.offline)).toBe(true);
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
    const accepted = await backend.acceptedGameMoves();
    const acceptedOwners = accepted.flatMap((move) =>
      move.owner_id === null ? [] : [move.owner_id]
    );
    const expectedOwners = playing.flatMap((user) =>
      user.account_id === null ? [] : [user.account_id]
    );
    expect(new Set(acceptedOwners)).toEqual(new Set(expectedOwners));
  } finally {
    for (const session of sessions) session.abort();
    await backend.close();
  }
}, 60_000);
