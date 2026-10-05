import { multiplayerSpaceId } from '@libs/chess-matchmaking-harness/multiplayer-spaces';
import { multiplayerClient } from '@libs/chess-matchmaking-harness/multiplayer-client';
import {
  multiplayerFixture,
  multiplayerTransaction,
} from '@libs/chess-matchmaking-harness/multiplayer-fixtures';
import { acceptChessMatch } from '@libs/chess-matchmaking-shared/match-handoff';
import { OpponentRequested } from '@libs/chess-matchmaking-shared/opponent-requested';
import { scenarioAction } from '@libs/harness/actor-ui';
import { accountIdOf } from '@libs/harness/identity';
import { authorizeAppMutation } from '@libs/permissions-shared/authorize-app-mutation';
import type { MatchFormation } from '@pkgs/matchmaking-sql-shared/match-pass';
import { readCurrent } from '@pkgs/matchmaking-sql-shared/search-read';
import sql from '@pkgs/sql-root-shared/sql';
import { MutationError } from '@pkgs/sync-engine-shared/mutations-types';
import type { MultiplayerCommand } from './multiplayer-commands';
import { sendMultiplayerCommand } from './multiplayer-commands';

/**
 * The downstream model controls when an upstream fact arrives. Its commands
 * run the real mutation bodies; asynchronous upstream requests remain due
 * after this finite history. Assembled scenarios exercise ordinary delivery.
 */
export const controlledMultiplayerCommand = scenarioAction({
  name: 'controlledMultiplayerCommand',
  act: async (s, actor: string, command: MultiplayerCommand) => {
    const { env, engine } = await multiplayerClient(s, actor);
    if (!engine.status.getSnapshot().online) {
      await Promise.resolve(sendMultiplayerCommand.act(s, actor, command));
      return;
    }
    const session = env.createAuthClient().session.getSnapshot().session;
    if (session === null) return;
    const app = s.harness.composition.app;
    const mutation = (await app.mutations())[command.name];
    if (mutation === undefined)
      throw new Error(`Unknown command ${command.name}`);
    const parsed = await mutation.args['~standard'].validate({ spaceId: await multiplayerSpaceId(s, actor) ?? 'no-space', ...command.args });
    if (parsed.issues !== undefined)
      throw new Error('Invalid multiplayer command');
    await multiplayerFixture(s, actor, async (tx, serverEnv) => {
      const context = {
        tx,
        name: mutation.name,
        args: parsed.value,
        env: {
          ...serverEnv,
          ...(session.authenticatedAt === null
            ? {}
            : { authenticatedAtMs: session.authenticatedAt.getTime() }),
        },
        serverNow: serverEnv.now,
      };
      try {
        await authorizeAppMutation(context);
        await app.authorizeMutation(context);
        await mutation.run(context, parsed.value);
      } catch (error) {
        if (!(error instanceof MutationError)) throw error;
      }
      await tx.run(sql`UPDATE outbox_events SET available_at = ${new Date(s.harness.clock.now() + 86_400_000).toISOString()}
          WHERE type = ${OpponentRequested.type} AND deleted_at IS NULL`);
      return [serverEnv.actorId];
    });
  },
});

/** A published upstream fact, delivered to the production handoff handler. */
export const receiveMultiplayerMatch = scenarioAction({
  name: 'receiveMultiplayerMatch',
  act: (s, fact: MatchFormation) =>
    multiplayerTransaction(s, fact.participants[0]!.ownerId, async (tx) => {
      await acceptChessMatch(tx, fact, s.harness.clock.now(), s.harness.server.createId);
      return fact.participants.map((p) => p.ownerId);
    }),
});

/** Translate people and accepted references only; never select opponents. */
export async function multiplayerMatchFact(
  s: Parameters<typeof accountIdOf>[0],
  matchId: string,
  people: readonly string[]
): Promise<MatchFormation> {
  const participants = [];
  for (const actor of people) {
    const ownerId = await accountIdOf(s, actor);
    if (ownerId === null) throw new Error(`Missing ${actor}'s account`);
    const current = await readCurrent(
      s.harness.serverSql.sqlClient,
      ownerId,
      s.harness.clock.now()
    );
    if (current?.result?.status !== 'waiting')
      throw new Error('An upstream match needs accepted waits');
    participants.push({
      id: current.participantId,
      ownerId,
      joinedAtMs: current.joinedAtMs,
      data: current.result.data,
      metadata: current.result.metadata ?? null,
    });
  }
  return { matchId, participants };
}
