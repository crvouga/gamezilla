import { Handles } from '@libs/test-ids';
import { describe } from '@pkgs/ui-testing';

import { AppDriver } from '../src/drivers/app-driver';
import { aliceAvatarCreds, aliceUserCreds } from '../src/fixtures/fixtures';
import { openSim } from '../src/setup/open-sim';

describe('profile edit', (ctx) => {
  ctx.test('guest updates username', async () => {
    await using s = await openSim('profile-edit-guest-username', ctx);
    const app = await AppDriver.forActor(s, 'alice');
    await app.profile.openEdit();
    await app.profile.setUsername('guest_user_1');
    await app.profile.expectUsername('guest_user_1');
  });

  ctx.test('guest updates avatar', async () => {
    await using s = await openSim('profile-edit-guest-avatar', ctx);
    const app = await AppDriver.forActor(s, 'alice');
    await app.profile.openEdit();
    await app.profile.openAvatarEditor();
    await app.profile.setAvatarSeed('sim-seed-guest');
    await app.profile.setAvatarStyle(Handles.profileAvatarStyleBottts);
    await app.profile.expectAvatarStyleLabel('Bottts');
    await app.profile.expectAvatarTraitVisible();
    await app.profile.saveAvatar();
    await app.profile.leaveAvatarEditor();
    await app.profile.openAvatarEditor();
    await app.profile.expectAvatarSeed('sim-seed-guest');
    await app.profile.expectAvatarStyleLabel('Bottts');
  });

  ctx.test('signed-in updates username', async () => {
    await using s = await openSim('profile-edit-signed-username', ctx);
    const app = await AppDriver.forActor(s, 'alice');
    await app.auth.signInWithDev(aliceUserCreds);
    await app.auth.returnToTabs();
    await app.profile.openEdit();
    await app.profile.setUsername('signed_alice_1');
    await app.profile.expectUsername('signed_alice_1');
  });

  ctx.test('signed-in updates avatar', async () => {
    await using s = await openSim('profile-edit-signed-avatar', ctx);
    const app = await AppDriver.forActor(s, 'alice');
    await app.auth.signInWithDev(aliceAvatarCreds);
    await app.auth.returnToTabs();
    await app.profile.openEdit();
    await app.profile.openAvatarEditor();
    await app.profile.setAvatarSeed('sim-seed-signed');
    await app.profile.setAvatarStyle(Handles.profileAvatarStyleBottts);
    await app.profile.expectAvatarStyleLabel('Bottts');
    await app.profile.expectAvatarTraitVisible();
    await app.profile.saveAvatar();
    await app.profile.leaveAvatarEditor();
    await app.profile.openAvatarEditor();
    await app.profile.expectAvatarSeed('sim-seed-signed');
    await app.profile.expectAvatarStyleLabel('Bottts');
  });
});
