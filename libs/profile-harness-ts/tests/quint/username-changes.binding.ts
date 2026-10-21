/**
 * `specs/profile/username-changes.qnt` against the profile composition: each
 * username change saved through the username screen (the result it settles
 * on kept for `observe`), the connection lost and returned through the
 * network, and each person's saved username read through their editor and
 * their displayed name read through their own Profile screen.
 *
 * Time is the one thing the model leaves implicit: a step's saves happen "a
 * while after" the person's last one, so the binding lets more than the
 * change cooldown pass first; `renameTwice`'s second save follows its first
 * right away, with no state check between. Losing or regaining the
 * connection waits until the device has noticed, as a person would.
 */

import { partition, restoreActorConnection } from '@libs/harness-ts/actions';
import { returnToTabs, signInWithGoogle } from '@libs/harness-ts/auth-actions';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { accountIdOf } from '@libs/harness-ts/identity';
import { partitioned } from '@libs/harness-ts/observations';
import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import { focusActor } from '@libs/harness-ts/shell-actions';
import {
  leaveUsernameEditor,
  openProfileEdit,
  submitUsername,
} from '@libs/profile-harness-ts/profile-actions';
import {
  profileIdOf,
  readProfileUsernameShown,
  readSavedProfileUsername,
  readUsernameSaveFace,
  readUsernameSharedRefusalFace,
  standInNameOf,
  usernameWaitingToShareShown,
} from '@libs/profile-harness-ts/profile-ui-reads';
import {
  startAllowingUsername,
  stopAllowingUsername,
} from '@libs/profile-harness-ts/team-rule-actions';
import { USERNAME_CHANGE_COOLDOWN_MS } from '@libs/profile-shared-ts/username';
import type { QuintValue } from '@pkgs/quint-shared-ts/itf';
import { variant } from '@pkgs/quint-shared-ts/itf';
import type { Picks } from '@pkgs/quint-shared-ts/registry';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';

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
  'That username is not allowed': 'NotAllowed',
};

/** Each person's stand-in name, as the model names it. */
const STAND_INS: Readonly<Record<string, string>> = {
  alice: 'Brave Tiger 1',
  bob: 'Calm Otter 2',
  carol: 'Swift Heron 3',
};

const generatedKey = (actor: string) => `generated-username:${actor}`;
const lastUsernameChangeKey = (actor: string) =>
  `last-username-change:${actor}`;

function person(picks: Picks): string {
  return String(picks['person']);
}

/** Save `typed` on a fresh username screen; keep the result it shows. */
async function save(w: QuintHarnessWorld, actor: string, typed: string) {
  await w.s.apply(focusActor, actor);
  await w.s.apply(openProfileEdit, actor);
  await w.s.apply(submitUsername, actor, typed);
  const face = await w.s.read(readUsernameSaveFace, actor);
  w.memo.set(lastUsernameChangeKey(actor), face);
  await w.s.apply(leaveUsernameEditor, actor);
  const away = await w.quiet.read(partitioned);
  if (
    face === 'Saved' &&
    !away.some((pair) => pair.split('|').includes(actor))
  ) {
    await w.quiet.until(
      (s: ProductHarness) => usernameWaitingToShareShown(s, actor),
      {
        pred: (waiting) => !waiting,
      }
    );
    const refusal = await w.quiet.read(readUsernameSharedRefusalFace, actor);
    if (refusal !== null) w.memo.set(lastUsernameChangeKey(actor), refusal);
  }
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
  // Check every invariant at the original bound in independent solver groups.
  boundedInvariantGroupSize: 1,
  encoding: 'fun-arrays',
  inferPolymorphicTypes: false,
  invariantMode: 'before',
  actions: {
    init: async (w) => {
      for (const actor of SIGNED_IN) {
        await w.s.apply(signInWithGoogle, actor);
        await w.s.apply(returnToTabs, actor);
        const id = await w.s.read(accountIdOf, actor);
        if (id === null) throw new Error(`${actor} did not sign in`);
        await save(w, actor, actor);
        w.memo.delete(lastUsernameChangeKey(actor));
      }
      await w.s.apply(focusActor, GUEST);
      const [guestId] = await w.s.until(
        async (s: ProductHarness) => {
          const id = await profileIdOf(s, GUEST);
          return id === null ? [] : [id];
        },
        { pred: (ids) => ids.length === 1 }
      );
      if (guestId === undefined) throw new Error(`${GUEST} has no profile`);
      const generated = await w.s.until(
        (s: ProductHarness) => readSavedProfileUsername(s, GUEST),
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
    connectionReturns: async (w, picks) => {
      const actor = person(picks);
      const waiting = await w.quiet.read(usernameWaitingToShareShown, actor);
      await w.s.apply(restoreActorConnection, actor);
      await w.s.advanceTime(NOTICE_MS);
      if (waiting) {
        await w.quiet.until(
          (s: ProductHarness) => usernameWaitingToShareShown(s, actor),
          {
            pred: (pending) => !pending,
          }
        );
        const refusal = await w.quiet.read(
          readUsernameSharedRefusalFace,
          actor
        );
        if (refusal !== null) w.memo.set(lastUsernameChangeKey(actor), refusal);
      }
    },
    stopAllowing: async (w, picks) => {
      await w.s.apply(stopAllowingUsername, String(picks['name']));
    },
    startAllowing: async (w, picks) => {
      await w.s.apply(startAllowingUsername, String(picks['name']));
    },
  },
  observe: async (w) => {
    const usernames = new Map<QuintValue, QuintValue>();
    const usernamesOnDevice = new Map<QuintValue, QuintValue>();
    const lastUsernameChange = new Map<QuintValue, QuintValue>();
    for (const actor of PEOPLE) {
      const saved = await w.quiet.read(readSavedProfileUsername, actor);
      usernames.set(actor, asModelUsername(w, actor, saved));
      const standIn = await w.quiet.read(standInNameOf, actor);
      const onDevice = await w.quiet.until(
        (s: ProductHarness) => readProfileUsernameShown(s, actor),
        { pred: (shown) => shown !== null }
      );
      usernamesOnDevice.set(
        actor,
        onDevice === standIn
          ? (STAND_INS[actor] ?? actor)
          : asModelUsername(w, actor, onDevice)
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
