/**
 * The User Observatory's words that other contexts borrow: being allowed to
 * view it, opening it, and someone using the app now.
 */
import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import { Given, When } from '@libs/harness-ts/define';
import type { Actor } from '@libs/harness-ts/parameter-types';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { grantOperatorPermissions } from './operator-access-actions';
import { openPersonApp, openUserObservatory } from './user-observatory-actions';

Given(
  '{actor} is authorized to view the User Observatory',
  async (w, actor: Actor) => {
    await w.s.apply(signInWithGoogle, actor);
    await w.s.apply(grantOperatorPermissions, actor, [
      PERMISSION.observatoryView,
    ]);
  }
);
Given('{actor} is using the app now', async (w, actor: Actor) => {
  await w.s.apply(openPersonApp, actor);
});
When('{actor} opens the User Observatory', async (w, actor: Actor) => {
  await w.s.apply(openUserObservatory, actor);
});
