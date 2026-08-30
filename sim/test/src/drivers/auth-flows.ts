import { Handles } from '@libs/dst-handles';
import type { Driver } from '@pkgs/ui-testing';

export type DevCredentials = {
  readonly subject: string;
};

export class AuthFlows {
  constructor(private readonly ui: Driver) {}

  async signInWithDev(creds: DevCredentials): Promise<void> {
    await this.ui.tap(Handles.statusCurrentUser);
    await this.ui.tap(Handles.accountSignIn);
    // Multi-actor: second client may still be hydrating client_config /
    // paintReady before Dev shows (methodsLoading gate).
    await this.ui.tap(Handles.authMethodDev, { timeoutMs: 15_000 });
    await this.ui.input(Handles.authSubjectInput, creds.subject);
    await this.ui.tap(Handles.authSubmitDev);
    await this.ui.tap(Handles.authSignedInDone, { timeoutMs: 15_000 });
    // dismissModal can flash idle + Close before unmount; dismiss when present.
    // `tap` already waits for visibility — short timeout avoids hanging if gone.
    try {
      await this.ui.tap(Handles.authModalClose, { timeoutMs: 1000 });
    } catch {
      // Modal already unmounted after Done.
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
