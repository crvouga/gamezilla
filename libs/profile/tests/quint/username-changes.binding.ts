/**
 * `specs/profile/username-changes.qnt` against the profile composition: each
 * username change saved through the username screen (the result it settles
 * on kept for `observe`), the connection lost and returned through the
 * network, and each person's username read back as everyone else sees it
 * and as their own device shows it.
 *
 * Time is the one thing the model leaves implicit: a step's saves happen "a
 * while after" the person's last one, so the binding lets more than the
 * change cooldown pass first; `renameTwice`'s second save follows its first
 * right away, with no state check between. Losing or regaining the
 * connection waits until the device has noticed, as a person would.
 */

import {
  focusActor,
  partition,
  partitioned,
  restoreNetwork,
  returnToTabs,
  signInWithGoogle,
} from '@libs/harness';
import type { QuintHarnessWorld } from '@libs/harness/quint/world';
import type { ProductHarness } from '@libs/harness/system/harness';
import { accountIdOf, actorLocalSql } from '@libs/harness/system/identity';
import {
  leaveUsernameEditor,
  openProfileEdit,
  submitUsername,
} from '@libs/profile/harness/profile-actions';
import { readUsernameSaveFace } from '@libs/profile/harness/profile-ui-reads';
import { USERNAME_CHANGE_COOLDOWN_MS } from '@libs/profile/public/username';
import { type QuintValue, variant } from '@pkgs/quint/itf';
import { bindQuintModel, type Picks } from '@pkgs/quint/registry';
import { sql } from '@pkgs/sql';

const SIGNED_IN = ['alice', 'bob'] as const;
const GUEST = 'carol';
const PEOPLE = [...SIGNED_IN, GUEST] as const;

/** Long enough for a device to notice its connection went or came back. */
const NOTICE_MS = 2_000;

/** What a username change shows, by its model result. */
const USERNAME_CHANGE_RESULTS: Readonly<Record<string, string>> = {
  Saved: 'UsernameSaved',
  'Username is taken': 'UsernameTaken',
  'Username was changed recently': 'ChangedRecently',
  "You're offline": 'RefusedOffline',
};

const profileIdKey = (actor: string) => `profile-id:${actor}`;
const generatedKey = (actor: string) => `generated-username:${actor}`;
const lastUsernameChangeKey = (actor: string) =>
  `last-username-change:${actor}`;

function person(picks: Picks): string {
  return String(picks['person']);
}

function profileIdOf(w: QuintHarnessWorld, actor: string): string {
  const id = w.memo.get(profileIdKey(actor));
  if (typeof id !== 'string') throw new Error(`no profile id for ${actor}`);
  return id;
}

/** The device's own profile rows (a device holds only its own). */
async function localProfileIds(
  s: ProductHarness,
  actor: string
): Promise<string[]> {
  const db = actorLocalSql(s, actor);
  if (db === null) return [];
  const rows = await db.query(sql<{ readonly id: string }>`
    SELECT id FROM profile WHERE deleted_at IS NULL`);
  return rows.map((row) => row.id);
}

async function usernameOnDevice(
  s: ProductHarness,
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

async function username(
  s: ProductHarness,
  profileId: string
): Promise<string | null> {
  const rows = await s.harness.serverSql.sqlClient.query(sql<{
    readonly username: string;
  }>`
    SELECT username FROM profile
    WHERE id = ${profileId} AND deleted_at IS NULL`);
  return rows[0]?.username ?? null;
}

/** Save `typed` on a fresh username screen; keep the result it shows. */
async function save(w: QuintHarnessWorld, actor: string, typed: string) {
  await w.s.apply(focusActor, actor);
  await w.s.apply(openProfileEdit, actor);
  await w.s.apply(submitUsername, actor, typed);
  const face = await w.s.read(readUsernameSaveFace, actor);
  w.memo.set(lastUsernameChangeKey(actor), face);
  await w.s.apply(leaveUsernameEditor, actor);
}

function asModelUsername(
  w: QuintHarnessWorld,
  actor: string,
  name: string | null
) {
  if (name === null) return '(no profile)';
  return name === w.memo.get(generatedKey(actor)) ? 'generated' : name;
}

bindQuintModel<QuintHarnessWorld>({
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
        (s: ProductHarness) => localProfileIds(s, GUEST),
        { pred: (ids) => ids.length === 1 }
      );
      if (guestId === undefined) throw new Error(`${GUEST} has no profile`);
      w.memo.set(profileIdKey(GUEST), guestId);
      const generated = await w.s.until(
        (s: ProductHarness) => username(s, guestId),
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
    const usernames = new Map<QuintValue, QuintValue>();
    const usernamesOnDevice = new Map<QuintValue, QuintValue>();
    const lastUsernameChange = new Map<QuintValue, QuintValue>();
    for (const actor of PEOPLE) {
      const id = profileIdOf(w, actor);
      usernames.set(
        actor,
        asModelUsername(w, actor, await w.quiet.read(username, id))
      );
      usernamesOnDevice.set(
        actor,
        asModelUsername(
          w,
          actor,
          await w.quiet.read(usernameOnDevice, actor, id)
        )
      );
      const face = w.memo.get(lastUsernameChangeKey(actor));
      lastUsernameChange.set(
        actor,
        typeof face === 'string'
          ? variant(USERNAME_CHANGE_RESULTS[face] ?? `Unexpected(${face})`)
          : variant('NoUsernameChange')
      );
    }
    return {
      username: usernames,
      usernameOnDevice: usernamesOnDevice,
      lastUsernameChange,
      offline: new Set(
        (await w.quiet.read(partitioned))
          .flatMap((pair) => pair.split('|'))
          .filter((actor) => PEOPLE.some((person) => person === actor))
      ),
    };
  },
});
