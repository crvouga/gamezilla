/**
 * `specs/profile/username-changes.qnt` against the profile composition: each
 * save through the username screen (the answer its save button settles on
 * kept for `observe`), the connection cut and healed through the network,
 * and each person's name read back from their own device's copy and the
 * server's.
 *
 * Time is the one thing the model leaves implicit: a step's saves happen "a
 * while after" the person's last one, so the binding lets more than the
 * change cooldown pass first; `renameTwice`'s second save follows its first
 * right away, with no state check between. Losing or regaining the
 * connection waits until the device has noticed, as a person would.
 */

import { USERNAME_CHANGE_COOLDOWN_MS } from '@libs/profile/public/username';
import {
  leaveUsernameEditor,
  openProfileEdit,
  submitUsername,
} from '@libs/profile/sim/profile-actions';
import { readUsernameSaveFace } from '@libs/profile/sim/profile-ui-reads';
import {
  focusActor,
  partition,
  restoreNetwork,
  returnToTabs,
  signInWithGoogle,
} from '@libs/sim-harness';
import type { QuintSimWorld } from '@libs/sim-harness/quint/world';
import { accountIdOf, actorLocalSql } from '@libs/sim-harness/system/identity';
import type { ProductSim } from '@libs/sim-harness/system/sim';
import { type QuintValue, variant } from '@pkgs/quint/itf';
import { bindQuintModel, type Picks } from '@pkgs/quint/registry';
import { sql } from '@pkgs/sql';

const SIGNED_IN = ['alice', 'bob'] as const;
const GUEST = 'carol';
const PEOPLE = [...SIGNED_IN, GUEST] as const;

/** Long enough for a device to notice its connection went or came back. */
const NOTICE_MS = 2_000;

const ANSWERS: Readonly<Record<string, string>> = {
  Saved: 'Saved',
  'Username is taken': 'Taken',
  'Username was changed recently': 'ChangedRecently',
  "You're offline": 'Offline',
};

const profileIdKey = (actor: string) => `profile-id:${actor}`;
const generatedKey = (actor: string) => `generated-username:${actor}`;
const answerKey = (actor: string) => `answer:${actor}`;

function person(picks: Picks): string {
  return String(picks['person']);
}

function profileIdOf(w: QuintSimWorld, actor: string): string {
  const id = w.memo.get(profileIdKey(actor));
  if (typeof id !== 'string') throw new Error(`no profile id for ${actor}`);
  return id;
}

/** The device's own profile rows (a device holds only its own). */
async function localProfileIds(
  s: ProductSim,
  actor: string
): Promise<string[]> {
  const db = actorLocalSql(s, actor);
  if (db === null) return [];
  const rows = await db.query(sql<{ readonly id: string }>`
    SELECT id FROM profile WHERE deleted_at IS NULL`);
  return rows.map((row) => row.id);
}

async function localUsername(
  s: ProductSim,
  actor: string,
  profileId: string
): Promise<string | null> {
  const db = actorLocalSql(s, actor);
  if (db === null) return null;
  const rows = await db.query(sql<{ readonly username: string }>`
    SELECT username FROM profile
    WHERE id = ${profileId} AND deleted_at IS NULL`);
  return rows[0]?.username ?? null;
}

async function serverUsername(
  s: ProductSim,
  profileId: string
): Promise<string | null> {
  const rows = await s.sim.serverSql.sqlClient.query(sql<{
    readonly username: string;
  }>`
    SELECT username FROM profile
    WHERE id = ${profileId} AND deleted_at IS NULL`);
  return rows[0]?.username ?? null;
}

/** Save `typed` on a fresh username screen; keep what the button said. */
async function save(w: QuintSimWorld, actor: string, typed: string) {
  await w.s.apply(focusActor, actor);
  await w.s.apply(openProfileEdit, actor);
  await w.s.apply(submitUsername, actor, typed);
  const face = await w.s.read(readUsernameSaveFace, actor);
  w.memo.set(answerKey(actor), face);
  await w.s.apply(leaveUsernameEditor, actor);
}

function asModelName(w: QuintSimWorld, actor: string, name: string | null) {
  if (name === null) return '(no profile)';
  return name === w.memo.get(generatedKey(actor)) ? 'generated' : name;
}

bindQuintModel<QuintSimWorld>({
  model: 'username-changes',
  traces: 8,
  maxSteps: 10,
  timeoutMs: 180_000,
  actions: {
    init: async (w) => {
      for (const actor of SIGNED_IN) {
        await w.s.apply(signInWithGoogle, actor);
        await w.s.apply(returnToTabs, actor);
        const id = await w.s.read(accountIdOf, actor);
        if (id === null) throw new Error(`${actor} did not sign in`);
        w.memo.set(profileIdKey(actor), id);
      }
      await w.s.apply(focusActor, GUEST);
      const [guestId] = await w.s.until(
        (s: ProductSim) => localProfileIds(s, GUEST),
        { pred: (ids) => ids.length === 1 }
      );
      if (guestId === undefined) throw new Error(`${GUEST} has no profile`);
      w.memo.set(profileIdKey(GUEST), guestId);
      const generated = await w.s.until(
        (s: ProductSim) => serverUsername(s, guestId),
        { pred: (name) => name !== null }
      );
      w.memo.set(generatedKey(GUEST), generated);
    },
    rename: async (w, picks) => {
      await w.s.advanceTime(USERNAME_CHANGE_COOLDOWN_MS + 1_000);
      await save(w, person(picks), String(picks['typed']));
    },
    renameTwice: async (w, picks) => {
      await w.s.advanceTime(USERNAME_CHANGE_COOLDOWN_MS + 1_000);
      await save(w, person(picks), String(picks['typed']));
      await save(w, person(picks), String(picks['retyped']));
    },
    loseConnection: async (w, picks) => {
      await w.s.apply(partition, person(picks));
      await w.s.advanceTime(NOTICE_MS);
    },
    connectionReturns: async (w) => {
      await w.s.apply(restoreNetwork);
      await w.s.advanceTime(NOTICE_MS);
    },
  },
  observe: async (w) => {
    const server = new Map<QuintValue, QuintValue>();
    const device = new Map<QuintValue, QuintValue>();
    const answer = new Map<QuintValue, QuintValue>();
    for (const actor of PEOPLE) {
      const id = profileIdOf(w, actor);
      server.set(
        actor,
        asModelName(w, actor, await w.quiet.read(serverUsername, id))
      );
      device.set(
        actor,
        asModelName(w, actor, await w.quiet.read(localUsername, actor, id))
      );
      const face = w.memo.get(answerKey(actor));
      answer.set(
        actor,
        typeof face === 'string'
          ? variant(ANSWERS[face] ?? `Unexpected(${face})`)
          : variant('NoAnswer')
      );
    }
    return { server, device, answer };
  },
});
