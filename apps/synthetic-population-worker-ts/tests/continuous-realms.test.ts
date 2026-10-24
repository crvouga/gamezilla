import { expect, test } from 'bun:test';
import type { ManagedSession } from '@apps/synthetic-population-worker-ts/managed-session';
import { pongPositionCodec } from '@libs/pong-shared-ts/pong-game';
import { inspectionSchema } from '@libs/synthetic-population-shared-ts/inspection';
import { runtimeBackend } from './runtime-backend';
import {
  awaitRuntimeUsers,
  runtimeHeartbeat,
  runtimeSession,
} from './runtime-session';

test('native Synthetic User realms guide both Pong paddles through normal controls and authoritative inputs', async () => {
  // regression: native-pong-controls-unavailable
  const backend = await runtimeBackend(2);
  const sessions: ManagedSession[] = [];
  try {
    const workerId = backend.wall.createId();
    await runtimeHeartbeat(backend, workerId, 'pong-realm');
    const realms = await Promise.all(
      [0, 1].map(async () => {
        const realm = await runtimeSession(
          backend,
          workerId,
          'pong-realm',
          'native-pong-pair'
        );
        sessions.push(realm.session);
        await realm.authenticated;
        return realm;
      })
    );
    const users = await awaitRuntimeUsers(backend, (users) =>
      users.every((user) => user.activity === 'playing')
    );
    expect(new Set(users.map((user) => user.account_id)).size).toBe(2);
    await awaitRuntimeUsers(backend, async () => {
      const checkpoints = await backend.liveGames();
      return checkpoints.some((game) => {
        const state = game === null ? null : pongPositionCodec.decode(game.fen);
        return (
          state !== null &&
          state.paddles.left.input.kind === 'target' &&
          state.paddles.right.input.kind === 'target'
        );
      });
    });
    for (const realm of realms) {
      const timeline = await backend.repository.events(
        realm.assignment.lease.userId
      );
      expect(timeline.some((event) => event.event === 'MoveSubmitted')).toBe(
        false
      );
      expect(
        timeline.some(
          (event) =>
            event.event === 'UiDriverAction' &&
            typeof event.context === 'object' &&
            event.context !== null &&
            'action' in event.context &&
            String(event.context.action).includes('-control') &&
            'outcome' in event.context &&
            event.context.outcome === 'completed'
        )
      ).toBe(true);
    }
  } catch (error) {
    const users = await backend.repository.users();
    for (const user of users)
      await backend.administration.command(
        user.id,
        { operationId: backend.wall.createId(), command: 'inspect' },
        user.worker_id!
      );
    await Promise.all(sessions.map((session) => session.renew(false)));
    const inspected = await awaitRuntimeUsers(backend, (users) =>
      users.every((user) => user.inspection !== null)
    );
    const boards = inspected.map((user) => {
      const snapshot = inspectionSchema.parse(user.inspection);
      const doc = new DOMParser().parseFromString(snapshot.html, 'text/html');
      const game = doc.querySelector('[data-testid="multiplayer-game"]');
      return { game: game?.outerHTML, actions: snapshot.actions.slice(-5) };
    });
    throw new Error(
      `${String(error)}; inspections: ${JSON.stringify(boards)}`,
      { cause: error }
    );
  } finally {
    for (const session of sessions) session.abort();
    await backend.close();
  }
}, 60_000);
