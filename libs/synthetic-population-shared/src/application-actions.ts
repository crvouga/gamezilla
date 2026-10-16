import { Handles } from '@libs/test-ids-shared/handles';
import type { Driver } from '@pkgs/ui-testing-root-shared/driver';

export async function openAccount(driver: Driver): Promise<void> {
  if (
    (await driver.get(Handles.accountSignIn).isVisible()) ||
    (await driver.get(Handles.accountSignInMethods).isVisible())
  )
    return;
  await driver.get(Handles.statusCurrentUser).tap();
  await driver.get(Handles.globalMenuAccount).tap({ timeoutMs: 15_000 });
}
export type SyntheticSignIn = {
  /** The Synthetic User's provisioned address. */
  readonly email: string;
  /**
   * Takes the newest sign-in link from the user's internal inbox over the
   * worker control plane. A link is handed out once; `null` when none waits.
   */
  readonly takeSignInLink: () => Promise<string | null>;
};

const SIGN_IN_WAIT = { timeoutMs: 30_000 };

/**
 * One attempt, as a person would make it: ask for a link, read the mail,
 * paste the link. The Driver can only tap and type, so the link is typed
 * into the form rather than opened.
 */
async function signInByEmailedLink(
  driver: Driver,
  input: SyntheticSignIn
): Promise<boolean> {
  await driver.get(Handles.accountSignIn).tap();
  await driver.get(Handles.authMethodEmail).tap();
  await driver.get(Handles.authEmailAddress).input(input.email);
  await driver.get(Handles.authEmailRequestLink).tap();
  await driver.get(Handles.authEmailLink).wait('visible', SIGN_IN_WAIT);
  const link = await input.takeSignInLink();
  if (link === null)
    throw new Error('No sign-in link reached the internal inbox');
  await driver.get(Handles.authEmailLink).input(link);
  await driver.get(Handles.authEmailSignIn).tap();
  await driver.get(Handles.authSignInOutcome).wait('visible', SIGN_IN_WAIT);
  return !(await driver.get(Handles.authSignInFailed).isVisible());
}
export async function authenticateThroughUi(
  driver: Driver,
  input: SyntheticSignIn
): Promise<void> {
  await openAccount(driver);
  if (!(await signInByEmailedLink(driver, input))) {
    // A spent link can lose its acknowledgement. A fresh link proves the identity again.
    await driver.get(Handles.authModalClose).tap();
    if (!(await signInByEmailedLink(driver, input)))
      throw new Error('Normal authentication was refused');
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
  if (await driver.get(Handles.authSignOutModal).isVisible())
    await driver.get(Handles.authSignOutDone).tap();
  await driver.get(Handles.authSignOutModal).wait('hidden');
}
