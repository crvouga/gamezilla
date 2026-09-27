/** Profile steps other packages reuse (`@libs/profile/steps/profile.steps`). */

import { expect } from 'bun:test';

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
} from '@libs/profile/sim/profile-actions';
import {
  avatarTraitVisible,
  readAvatarSeed,
  readAvatarStyleLabel,
  readProfileTabUsername,
  readUsername,
  readUsernameSaveFace,
} from '@libs/profile/sim/profile-ui-reads';
import {
  focusActor,
  openAccount,
  returnToTabs,
  signInWithGoogleAsAccount,
  signOut,
} from '@libs/sim-harness';
import { type Actor, Given, Then, When } from '@libs/sim-harness/spec/define';
import { recall, remember } from '@libs/sim-harness/spec/world';
import { Handles } from '@libs/test-ids';

const loadedUsernameKey = (actor: Actor) => `loaded-username:${actor}`;

Given('{actor} is editing their profile', async (w, actor: Actor) => {
  await w.s.apply(openProfileEdit, actor);
});

When('{actor} signs out', async (w, actor: Actor) => {
  await w.s.apply(openAccount, actor);
  await w.s.apply(signOut, actor);
});

Then('{actor} can sign in again', async (w, actor: Actor) => {
  const visible = await w.s.read(async (sim) => {
    const ui = sim.actors.get(actor)?.ui;
    return ui === undefined
      ? false
      : await ui.get(Handles.accountSignIn).isVisible();
  });
  expect(visible).toBe(true);
});

When('{actor} returns to the tabs', async (w, actor: Actor) => {
  await w.s.apply(returnToTabs, actor);
});

When("{actor}'s account opens on another device", async (w, actor: Actor) => {
  await w.s.apply(signInWithGoogleAsAccount, 'alice_phone', actor);
  await w.s.apply(returnToTabs, 'alice_phone');
});

Then(
  "{actor}'s phone shows username {string}",
  async (w, actor: Actor, username: string) => {
    const phone = `${actor}_phone`;
    await w.s.until((sim) => readProfileTabUsername(sim, phone), {
      pred: (actual) => actual === username,
    });
  }
);

When(
  "{actor}'s phone changes username to {string}",
  async (w, actor: Actor, username: string) => {
    const phone = `${actor}_phone`;
    await w.s.apply(openProfileEdit, phone);
    await w.s.apply(submitUsername, phone, username);
    await w.s.apply(leaveUsernameEditor, phone);
  }
);

Then(
  "{actor} sees the phone's username {string}",
  async (w, actor: Actor, username: string) => {
    await w.s.apply(focusActor, actor);
    await w.s.until((sim) => readProfileTabUsername(sim, actor), {
      pred: (actual) => actual === username,
      maxMs: 15_000,
    });
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
  '{actor} saves an avatar with seed {string} and style {string}',
  async (w, actor: Actor, seed: string, style: string) => {
    await w.s.apply(openProfileEdit, actor);
    await w.s.apply(openAvatarEditor, actor);
    await w.s.apply(setAvatarSeed, actor, seed);
    await w.s.apply(
      setAvatarStyle,
      actor,
      style,
      Handles.profileAvatarStyleBottts
    );
    await w.s.apply(saveAvatar, actor);
    await w.s.apply(leaveAvatarEditor, actor);
  }
);

Given(
  '{actor} has saved an avatar with seed {string} and style {string}',
  async (w, actor: Actor, seed: string, style: string) => {
    await w.s.apply(openProfileEdit, actor);
    await w.s.apply(openAvatarEditor, actor);
    await w.s.apply(setAvatarSeed, actor, seed);
    await w.s.apply(
      setAvatarStyle,
      actor,
      style,
      Handles.profileAvatarStyleBottts
    );
    await w.s.apply(saveAvatar, actor);
    await w.s.apply(leaveAvatarEditor, actor);
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
  "{actor}'s saved avatar has seed {string}",
  async (w, actor: Actor, seed: string) => {
    await w.s.apply(openAvatarEditor, actor);
    await w.s.until((sim) => readAvatarSeed(sim, actor), {
      pred: (actual) => actual === seed,
    });
  }
);

Then(
  "{actor}'s saved avatar uses style {string}",
  async (w, actor: Actor, style: string) => {
    expect(await w.s.read(readAvatarStyleLabel, actor)).toContain(style);
    expect(await w.s.read(avatarTraitVisible, actor)).toBe(true);
  }
);

Then(
  "{actor}'s saved profile avatar has seed {string}",
  async (w, actor: Actor, seed: string) => {
    await w.s.apply(openProfileEdit, actor);
    await w.s.apply(openAvatarEditor, actor);
    await w.s.until((sim) => readAvatarSeed(sim, actor), {
      pred: (actual) => actual === seed,
    });
  }
);

Given("{actor}'s current username is recorded", async (w, actor: Actor) => {
  const username = await w.s.until(
    (sim) => readProfileTabUsername(sim, actor),
    {
      pred: (value) => value !== null,
    }
  );
  remember(w, loadedUsernameKey(actor), username);
  await w.s.apply(openProfileEdit, actor);
});

When(
  '{actor} tries to use username {string}',
  async (w, actor: Actor, username: string) => {
    await w.s.apply(submitUsername, actor, username);
  }
);

When(
  '{actor} drafts username {string} and cancels',
  async (w, actor: Actor, username: string) => {
    await w.s.apply(typeUsernameDraft, actor, username);
    await w.s.apply(leaveUsernameEditor, actor);
  }
);

Given(
  '{actor} has claimed username {string}',
  async (w, actor: Actor, username: string) => {
    await w.s.apply(openProfileEdit, actor);
    await w.s.apply(submitUsername, actor, username);
    expect(await w.s.read(readUsernameSaveFace, actor)).toBe('Saved');
    await w.s.apply(leaveUsernameEditor, actor);
  }
);

Then(
  "{actor}'s username change is refused with {string}",
  async (w, actor: Actor, reason: string) => {
    expect(await w.s.read(readUsernameSaveFace, actor)).toBe(reason);
  }
);

Then("{actor}'s username change is saved", async (w, actor: Actor) => {
  expect(await w.s.read(readUsernameSaveFace, actor)).toBe('Saved');
  await w.s.apply(leaveUsernameEditor, actor);
});

Then(
  "{actor}'s profile shows {username}",
  async (w, actor: Actor, username: string) => {
    await w.s.until((sim) => readUsername(sim, actor), {
      pred: (actual) => actual === username,
    });
  }
);

Then(
  "{actor}'s profile shows username {string}",
  async (w, actor: Actor, username: string) => {
    await w.s.until((sim) => readProfileTabUsername(sim, actor), {
      pred: (actual) => actual === username,
    });
  }
);

Then("{actor}'s profile keeps the loaded username", async (w, actor: Actor) => {
  const expected = recall(w, loadedUsernameKey(actor));
  await w.s.apply(leaveUsernameEditor, actor);
  await w.s.until((sim) => readProfileTabUsername(sim, actor), {
    pred: (actual) => actual === expected,
  });
});

Then(
  "{actor}'s profile still shows the loaded username",
  async (w, actor: Actor) => {
    const expected = recall(w, loadedUsernameKey(actor));
    await w.s.until((sim) => readProfileTabUsername(sim, actor), {
      pred: (actual) => actual === expected,
    });
  }
);

Then('each has their own generated username', async (w) => {
  const usernamePattern = /^[a-z0-9_]{3,32}$/i;
  const first = await w.s.until((sim) => readProfileTabUsername(sim, 'alice'), {
    pred: (value) => value !== null,
  });
  const second = await w.s.until((sim) => readProfileTabUsername(sim, 'bob'), {
    pred: (value) => value !== null,
  });
  expect(first).toMatch(usernamePattern);
  expect(second).toMatch(usernamePattern);
  expect(first).not.toBe(second);
});

Then('{actor} has a generated avatar seed', async (w, actor: Actor) => {
  await w.s.apply(openProfileEdit, actor);
  await w.s.apply(openAvatarEditor, actor);
  expect(await w.s.read(readAvatarSeed, actor)).not.toBe('');
});
