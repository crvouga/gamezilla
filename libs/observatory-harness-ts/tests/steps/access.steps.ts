import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import { Given, Then } from '@libs/harness-ts/define';
import type { Actor } from '@libs/harness-ts/parameter-types';
import { grantOperatorPermissions } from '@libs/observatory-actions-harness-ts/operator-access-actions';
import {
  observatoryDenied,
  openUserObservatory,
} from '@libs/observatory-actions-harness-ts/user-observatory-actions';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';

const SHOWN_MS = 10_000;

// Viewing is not watching: the User Observatory opens, watching live does not.
Given(
  '{actor} is not authorized to view the User Observatory',
  async (w, actor: Actor) => {
    await w.s.apply(signInWithGoogle, actor);
  }
);
Given('{actor} has opened the User Observatory', async (w, actor: Actor) => {
  await w.s.apply(signInWithGoogle, actor);
  await w.s.apply(grantOperatorPermissions, actor, [
    PERMISSION.observatoryView,
  ]);
  await w.s.apply(openUserObservatory, actor);
});
Given(
  '{actor} is authorized to watch someone live',
  async (w, actor: Actor) => {
    await w.s.apply(signInWithGoogle, actor);
    await w.s.apply(grantOperatorPermissions, actor, [
      PERMISSION.observatoryView,
      PERMISSION.observatoryWatch,
    ]);
  }
);
Given(
  '{actor} is not authorized to watch someone live',
  async (w, actor: Actor) => {
    await w.s.apply(signInWithGoogle, actor);
    await w.s.apply(grantOperatorPermissions, actor, [
      PERMISSION.observatoryView,
    ]);
  }
);
Then('{actor} is told that permission is required', async (w, actor: Actor) => {
  await w.s.until((s) => observatoryDenied(s, actor), {
    pred: Boolean,
    maxMs: SHOWN_MS,
  });
});
