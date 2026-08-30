import { afterAll, afterEach, beforeAll, describe, test } from '@jest/globals';
import { Handles } from '@libs/dst-handles';

import { AppDriver } from '../drivers/app-driver';
import { aliceAvatarCreds, aliceUserCreds } from '../fixtures/fixtures';
import { type OpenSimHandle, openSim } from '../setup/open-sim';

describe('profile edit', () => {
  let world: OpenSimHandle;

  beforeAll(async () => {
    world = await openSim('profile-edit');
  });

  afterAll(async () => {
    await world.dispose();
  });

  afterEach(async () => {
    await world.resetActor('alice');
  });

  test('guest updates username', async () => {
    const app = await AppDriver.forActor(world, 'alice');
    await app.profile.openEdit();
    await app.profile.setUsername('guest_user_1');
    await app.profile.expectUsername('guest_user_1');
  });

  test('guest updates avatar', async () => {
    const app = await AppDriver.forActor(world, 'alice');
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
    const app = await AppDriver.forActor(world, 'alice');
    await app.auth.signInWithDev(aliceUserCreds);
    await app.auth.returnToTabs();
    await app.profile.openEdit();
    await app.profile.setUsername('signed_alice_1');
    await app.profile.expectUsername('signed_alice_1');
  });

  test('signed-in updates avatar', async () => {
    const app = await AppDriver.forActor(world, 'alice');
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
