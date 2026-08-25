import { Handles } from '@libs/dst-handles';
import type { Driver } from '@pkgs/ui-testing';

export type EmailCredentials = {
  readonly email: string;
  readonly password: string;
  readonly username: string;
};

export class AuthFlows {
  constructor(private readonly ui: Driver) {}

  async signUpWithEmail(creds: EmailCredentials): Promise<void> {
    await this.ui.tap(Handles.statusCurrentUser);
    await this.ui.tap(Handles.accountSignIn);
    await this.ui.tap(Handles.authMethodEmail);
    await this.ui.tap(Handles.authGoToSignUp);
    await this.ui.input(Handles.authEmailInput, creds.email);
    await this.ui.input(Handles.authUsernameInput, creds.username);
    await this.ui.input(Handles.authPasswordInput, creds.password);
    await this.ui.input(Handles.authConfirmPasswordInput, creds.password);
    await this.ui.tap(Handles.authSubmitCreate);
    await this.ui.tap(Handles.authSignedInDone);
    // dismissModal can flash idle + Close before unmount; dismiss when present.
    if (await this.ui.isVisible(Handles.authModalClose)) {
      await this.ui.tap(Handles.authModalClose);
    }
  }

  async signOut(): Promise<void> {
    await this.ui.tap(Handles.accountSignOut);
    await this.ui.tap(Handles.authSignOutConfirm);
    await this.ui.expect.visible(Handles.authSignedOut);
  }

  async expectSignedOut(): Promise<void> {
    await this.ui.expect.visible(Handles.authSignedOut);
  }

  /** Leave Account stack for the tab shell (Profile tab visible again). */
  async returnToTabs(): Promise<void> {
    await this.ui.tap(Handles.navBack);
    await this.ui.expect.visible(Handles.tabProfile);
  }
}
