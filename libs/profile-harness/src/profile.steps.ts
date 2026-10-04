/** Profile steps other packages reuse (`@libs/profile/steps/profile.steps`). */

import { expect } from 'bun:test';
import {
  returnToTabs,
  signInWithGoogleAsAccount,
} from '@libs/harness/auth-actions';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { otherDevice } from '@libs/harness/platform';
import { focusActor } from '@libs/harness/shell-actions';
import type { HarnessWorld } from '@libs/harness/spec-world';
import {
  cancelAvatarEdits,
  leaveAvatarEditor,
  leaveUsernameEditor,
  openAvatarEditor,
  openProfileEdit,
  saveAvatar,
  setAvatarSeed,
  setAvatarStyle,
  setUsername,
  submitUsername,
  typeUsernameDraft,
} from './profile-actions';
import {
  readProfileTabUsername,
  readProfileUsernameShown,
  readSavedAvatar,
  readUsernameSaveFace,
} from './profile-ui-reads';

const SECOND_MS = 1_000;

async function saveAvatarAs(
  w: HarnessWorld,
  actor: Actor,
  seed: string,
  style: string
): Promise<void> {
  await w.s.apply(openProfileEdit, actor);
  await w.s.apply(openAvatarEditor, actor);
  await w.s.apply(setAvatarSeed, actor, seed);
  await w.s.apply(setAvatarStyle, actor, style);
  await w.s.apply(saveAvatar, actor);
  await w.s.apply(leaveAvatarEditor, actor);
}

// Setup, from any screen with the tabs: open Edit profile, then submit.
async function tryUsername(
  w: HarnessWorld,
  actor: string,
  username: string
): Promise<void> {
  await w.s.apply(openProfileEdit, actor);
  await w.s.apply(submitUsername, actor, username);
}

Given(
  '{actor} and {actor} are on fresh devices',
  async (w, first: Actor, second: Actor) => {
    const opened = await w.s.read(
      (harness) => harness.actors.has(first) || harness.actors.has(second)
    );
    if (opened) throw new Error(`${first} or ${second} already opened the app`);
  }
);

When(
  '{actor} and {actor} open the app',
  async (w, first: Actor, second: Actor) => {
    await w.s.apply(focusActor, first);
    await w.s.apply(focusActor, second);
  }
);

When("{actor}'s account opens on another device", async (w, actor: Actor) => {
  await w.s.apply(signInWithGoogleAsAccount, otherDevice(actor), actor);
  await w.s.apply(returnToTabs, otherDevice(actor));
});

Given(
  "{actor}'s username is {username}",
  async (w, actor: Actor, username: string) => {
    await tryUsername(w, actor, username);
    const face = await w.s.read(readUsernameSaveFace, actor);
    if (face !== 'Saved') {
      throw new Error(`${actor} could not take @${username}: ${face}`);
    }
    await w.s.apply(leaveUsernameEditor, actor);
  }
);

When(
  '{actor} renames themselves to {username}',
  async (w, actor: Actor, username: string) => {
    await w.s.apply(openProfileEdit, actor);
    await w.s.apply(setUsername, actor, username);
  }
);

When(
  '{actor} renames themselves to {username} on their other device',
  async (w, actor: Actor, username: string) => {
    await w.s.apply(openProfileEdit, otherDevice(actor));
    await w.s.apply(setUsername, otherDevice(actor), username);
  }
);

When(
  '{actor} tries to use username {string}',
  async (w, actor: Actor, username: string) => {
    await tryUsername(w, actor, username);
  }
);

When(
  '{actor} starts renaming themselves to {username} and leaves without saving',
  async (w, actor: Actor, username: string) => {
    await w.s.apply(openProfileEdit, actor);
    await w.s.apply(typeUsernameDraft, actor, username);
    await w.s.apply(leaveUsernameEditor, actor);
  }
);

When(
  '{actor} saves an avatar with seed {string} and style {string}',
  async (w, actor: Actor, seed: string, style: string) => {
    await saveAvatarAs(w, actor, seed, style);
  }
);

Given(
  '{actor} has saved an avatar with seed {string} and style {string}',
  async (w, actor: Actor, seed: string, style: string) => {
    await saveAvatarAs(w, actor, seed, style);
  }
);

When(
  '{actor} changes the avatar seed to {string} and leaves without saving',
  async (w, actor: Actor, seed: string) => {
    await w.s.apply(openAvatarEditor, actor);
    await w.s.apply(setAvatarSeed, actor, seed);
    await w.s.apply(cancelAvatarEdits, actor, true);
  }
);

Then(
  "{actor}'s profile shows {username}",
  async (w, actor: Actor, username: string) => {
    await w.s.until((harness) => readProfileUsernameShown(harness, actor), {
      pred: (shown) => shown === username,
    });
  }
);

Then(
  "{actor}'s profile shows {username} within {int} seconds",
  async (w, actor: Actor, username: string, seconds: number) => {
    await w.s.apply(focusActor, actor);
    await w.s.until((harness) => readProfileUsernameShown(harness, actor), {
      pred: (shown) => shown === username,
      maxMs: seconds * SECOND_MS,
    });
  }
);

Then(
  "{actor}'s other device shows {username}",
  async (w, actor: Actor, username: string) => {
    await w.s.until(
      (harness) => readProfileTabUsername(harness, otherDevice(actor)),
      {
        pred: (shown) => shown === username,
      }
    );
  }
);

Then(
  "{actor}'s username change is refused with {string}",
  async (w, actor: Actor, reason: string) => {
    expect(await w.s.read(readUsernameSaveFace, actor)).toBe(reason);
  }
);

Then(
  "{actor}'s saved avatar has seed {string}",
  async (w, actor: Actor, seed: string) => {
    await w.s.until((harness) => readSavedAvatar(harness, actor), {
      pred: (avatar) => avatar?.seed === seed,
    });
  }
);

Then(
  "{actor}'s saved avatar uses style {string}",
  async (w, actor: Actor, style: string) => {
    const avatar = await w.s.read(readSavedAvatar, actor);
    expect(avatar?.styleLabel).toContain(style);
    expect(avatar?.traitShown).toBe(true);
  }
);

Then(
  '{actor} and {actor} have different usernames',
  async (w, first: Actor, second: Actor) => {
    const firstName = await w.s.until(
      (harness) => readProfileUsernameShown(harness, first),
      { pred: (shown) => shown !== null && shown !== '' }
    );
    const secondName = await w.s.until(
      (harness) => readProfileUsernameShown(harness, second),
      { pred: (shown) => shown !== null && shown !== '' }
    );
    expect(firstName).not.toBe(secondName);
  }
);

Then('{actor} already has an avatar', async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  await w.s.until((harness) => readSavedAvatar(harness, actor), {
    pred: (avatar) => avatar !== null && (avatar.seed ?? '') !== '',
  });
});
