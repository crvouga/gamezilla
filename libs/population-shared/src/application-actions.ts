import { Handles } from '@libs/test-ids-shared/handles';
import type { Driver } from '@pkgs/ui-testing-root-shared/driver';

export async function openAccount(driver: Driver): Promise<void> {
  if (
    (await driver.get(Handles.accountSignIn).isVisible()) ||
    (await driver.get(Handles.accountSignInMethods).isVisible())
  )
    return;
  await driver.get(Handles.statusCurrentUser).tap();
  await driver.get(Handles.globalMenuAccount).tap();
}
export async function authenticateThroughUi(
  driver: Driver,
  credentials: { email: string; password: string; registered: boolean }
): Promise<void> {
  await openAccount(driver);
  await driver.get(Handles.accountSignIn).tap();
  await driver.get('auth-password-email').input(credentials.email);
  await driver.get('auth-password-secret').input(credentials.password);
  await driver
    .get(
      credentials.registered
        ? 'auth-password-sign-in'
        : 'auth-password-register'
    )
    .tap();
  try {
    await driver
      .get(Handles.authSignedInDone)
      .wait('visible', { timeoutMs: credentials.registered ? 30_000 : 5_000 });
  } catch (error) {
    // A committed registration can lose its acknowledgement. Prove the identity normally.
    if (
      credentials.registered ||
      !(await driver.get(Handles.authSignInFailed).isVisible())
    )
      throw error;
    await driver.get(Handles.authModalClose).tap();
    await driver.get(Handles.accountSignIn).tap();
    await driver.get('auth-password-email').input(credentials.email);
    await driver.get('auth-password-secret').input(credentials.password);
    await driver.get('auth-password-sign-in').tap();
    await driver
      .get(Handles.authSignedInDone)
      .wait('visible', { timeoutMs: 30_000 });
  }
  await driver.get(Handles.authSignedInDone).tap();
}
export async function configureUsername(
  driver: Driver,
  username: string
): Promise<void> {
  for (
    let depth = 0;
    depth < 8 && !(await driver.get(Handles.tabProfile).isVisible());
    depth += 1
  )
    await driver.get(Handles.navBack).tap();
  await driver.get(Handles.tabProfile).tap();
  if (
    (await driver.get(Handles.profileDisplayUsername).text())?.replace(
      /^@/,
      ''
    ) === username
  )
    return;
  await driver.get(Handles.profileEdit).tap();
  await driver.get(Handles.profileEditUsername).tap();
  await driver.get(Handles.profileUsernameInput).clear();
  await driver.get(Handles.profileUsernameInput).input(username);
  await driver.get(Handles.profileUsernameSave).tap();
  await driver.get(Handles.profileUsernameSave).expect.text('Saved');
  await driver.get(Handles.profileUsernameCancel).tap();
}
export async function openMultiplayer(driver: Driver): Promise<void> {
  for (const id of [Handles.gameMenuChess, 'chess-menu-multiplayer']) {
    if (await driver.get(id).isVisible()) await driver.get(id).tap();
  }
}
export async function leaveSpace(driver: Driver): Promise<void> {
  if (await driver.get(Handles.spaceChromeOverflow).isVisible())
    await driver.get(Handles.spaceChromeOverflow).tap();
  for (const pair of [
    [Handles.spaceLeave, Handles.spaceLeaveConfirm],
    [Handles.spaceEnd, Handles.spaceEndConfirm],
  ] as const) {
    if (!(await driver.get(pair[0]).isVisible())) continue;
    await driver.get(pair[0]).tap();
    await driver.get(pair[1]).tap();
    await driver.get(Handles.spaceMutationDismiss).tap();
    return;
  }
}
export async function logOutThroughUi(driver: Driver): Promise<void> {
  if (await driver.get('multiplayer-stop').isVisible())
    await driver.get('multiplayer-stop').tap();
  await leaveSpace(driver);
  await openAccount(driver);
  await driver.get(Handles.accountSignOut).tap();
  await driver.get(Handles.authSignOutConfirm).tap();
  await driver.get(Handles.accountSignIn).wait('visible');
}
