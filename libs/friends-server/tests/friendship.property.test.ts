/**
 * Model-based test of the friendship state machine: random walks of
 * send / accept / decline / cancel / remove / block / unblock (and clock
 * ticks across the 24h resend cooldown) between three users, run against the
 * real mutations on SQLite and against `friendship-model.ts`. Every step must
 * agree on the outcome code and on the live friendships, requests and blocks.
 */
import { describe, expect, test } from 'bun:test';

import { acceptFriendRequestMutation } from '@libs/friends-shared/accept-friend-request-mutation';
import { blockUserMutation } from '@libs/friends-shared/block-user-mutation';
import { cancelFriendRequestMutation } from '@libs/friends-shared/cancel-friend-request-mutation';
import { declineFriendRequestMutation } from '@libs/friends-shared/decline-friend-request-mutation';
import { removeFriendMutation } from '@libs/friends-shared/remove-friend-mutation';
import { sendFriendRequestMutation } from '@libs/friends-shared/send-friend-request-mutation';
import { unblockUserMutation } from '@libs/friends-shared/unblock-user-mutation';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import type { SqlClient } from '@pkgs/sql-client-shared/interface';
import fc from 'fast-check';
import type { RunnableMutation } from './friendship-harness';
import {
  applyMutation,
  openFriendsDb,
  readSnapshot,
} from './friendship-harness';
import type { FriendsModel, ModelRequest } from './friendship-model';
import {
  createModel,
  modelAccept,
  modelBlock,
  modelClose,
  modelRemove,
  modelSend,
  modelSnapshot,
  modelUnblock,
  RESEND_COOLDOWN_MS,
} from './friendship-model';

const T0 = Date.parse('2026-09-01T00:00:00.000Z');
const USERS = ['u_a', 'u_b', 'u_c'] as const;

type Real = { readonly db: SqlClient };
type Step = fc.AsyncCommand<FriendsModel, Real>;

/** `null` names a request id that was never created. */
function pickRequest(
  m: FriendsModel,
  ref: number | null
): ModelRequest | undefined {
  if (ref === null || m.requests.length === 0) return undefined;
  return m.requests[ref % m.requests.length];
}

async function agree(
  m: FriendsModel,
  real: Real,
  expected: string,
  actual: string
): Promise<void> {
  expect(actual).toBe(expected);
  expect(await readSnapshot(real.db)).toEqual(modelSnapshot(m));
}

function step(
  label: string,
  exec: (m: FriendsModel, real: Real) => Promise<void>
): Step {
  return {
    check: () => true,
    run: exec,
    toString: () => label,
  };
}

function apply(
  real: Real,
  m: FriendsModel,
  call: {
    readonly mutation: RunnableMutation;
    readonly actorId: string;
    readonly input: unknown;
  }
): Promise<string> {
  return applyMutation({ db: real.db, nowMs: m.nowMs, ...call });
}

const arbUser = fc.constantFrom(...USERS);
const arbRef = fc.option(fc.nat({ max: 20 }), { nil: null, freq: 8 });

const arbSend = fc.tuple(arbUser, arbUser).map(([from, to]) =>
  step(`send(${from}->${to})`, async (m, real) => {
    const id = `r${String(m.nextId++).padStart(3, '0')}`;
    const actual = await apply(real, m, {
      mutation: sendFriendRequestMutation,
      actorId: from,
      input: { requestId: id, toUserId: to },
    });
    await agree(m, real, modelSend(m, from, to, id), actual);
  })
);

const arbAccept = fc.tuple(arbUser, arbRef).map(([actor, ref]) =>
  step(`accept(${actor}, #${ref})`, async (m, real) => {
    const request = pickRequest(m, ref);
    const actual = await apply(real, m, {
      mutation: acceptFriendRequestMutation,
      actorId: actor,
      input: { requestId: request?.id ?? 'missing' },
    });
    await agree(m, real, modelAccept(m, actor, request), actual);
  })
);

const arbClose = fc
  .tuple(
    fc.constantFrom('declined' as const, 'cancelled' as const),
    arbUser,
    arbRef
  )
  .map(([as, actor, ref]) =>
    step(`${as}(${actor}, #${ref})`, async (m, real) => {
      const request = pickRequest(m, ref);
      const actual = await apply(real, m, {
        mutation:
          as === 'declined'
            ? declineFriendRequestMutation
            : cancelFriendRequestMutation,
        actorId: actor,
        input: { requestId: request?.id ?? 'missing' },
      });
      await agree(m, real, modelClose(m, actor, request, as), actual);
    })
  );

const arbPairAction = fc
  .tuple(fc.constantFrom('remove', 'block', 'unblock'), arbUser, arbUser)
  .map(([kind, actor, other]) =>
    step(`${kind}(${actor}, ${other})`, async (m, real) => {
      const mutation =
        kind === 'remove'
          ? removeFriendMutation
          : kind === 'block'
            ? blockUserMutation
            : unblockUserMutation;
      const actual = await apply(real, m, {
        mutation,
        actorId: actor,
        input: { userId: other, blockId: `blk-${m.nextId++}` },
      });
      const expected =
        kind === 'remove'
          ? modelRemove(m, actor, other)
          : kind === 'block'
            ? modelBlock(m, actor, other)
            : modelUnblock(m, actor, other);
      await agree(m, real, expected, actual);
    })
  );

const arbTick = fc
  .constantFrom(0, 1, 60_000, RESEND_COOLDOWN_MS - 1, RESEND_COOLDOWN_MS)
  .map((ms) =>
    step(`tick(${ms})`, async (m) => {
      m.nowMs += ms;
    })
  );

const arbCommands = fc.commands(
  [arbSend, arbSend, arbAccept, arbClose, arbPairAction, arbTick],
  { maxCommands: 40, size: 'large' }
);

describe('friendship state machine', () => {
  test('real mutations agree with the reference model', async () => {
    await assertProperty(
      'friends mutations = model',
      fc.asyncProperty(arbCommands, async (commands) => {
        const db = await openFriendsDb();
        await fc.asyncModelRun(
          () => ({ model: createModel(T0), real: { db } }),
          commands
        );
      })
    );
  });
});
