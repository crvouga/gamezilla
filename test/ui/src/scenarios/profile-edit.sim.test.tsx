import { describe, test } from '@jest/globals';
import { Handles } from '@libs/dst-handles';

import { AppDriver } from '../harness/app-driver';
import { aliceAvatarCreds, aliceUserCreds } from '../harness/fixtures';
import { openSim } from '../harness/open-sim';

describe('profile edit', () => {
  test('guest updates username', async () => {
    await using sim = await openSim('profile-guest-username');
    const app = await AppDriver.forActor(sim, 'alice');
    await app.profile.openEdit();
    await app.profile.setUsername('guest_user_1');
    await app.profile.expectUsername('guest_user_1');
  });

  test('guest updates avatar', async () => {
    await using sim = await openSim('profile-guest-avatar');
    const app = await AppDriver.forActor(sim, 'alice');
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

  test('signed-in updates username', async () => {
    await using sim = await openSim('profile-signed-in-username');
    const app = await AppDriver.forActor(sim, 'alice');
    await app.auth.signUpWithEmail(aliceUserCreds);
    await app.auth.returnToTabs();
    await app.profile.openEdit();
    await app.profile.setUsername('signed_alice_1');
    await app.profile.expectUsername('signed_alice_1');
  });

  test('signed-in updates avatar', async () => {
    await using sim = await openSim('profile-signed-in-avatar');
    const app = await AppDriver.forActor(sim, 'alice');
    await app.auth.signUpWithEmail(aliceAvatarCreds);
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
