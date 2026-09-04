import { Handles } from '@libs/test-ids';
import type { Driver } from '@pkgs/ui-testing';

export type DevCredentials = {
  readonly subject: string;
};

export class AuthFlows {
  constructor(private readonly ui: Driver) {}

  async signInWithDev(_creds?: DevCredentials): Promise<void> {
    await this.ui.get(Handles.statusCurrentUser).tap();
    await this.ui.get(Handles.accountSignIn).tap();
    // Multi-actor: second client may still be hydrating client_config /
    // paintReady before Dev shows (methodsLoading gate).
    await this.ui.get(Handles.authMethodDev).tap({ timeoutMs: 15_000 });
    await this.ui.get(Handles.authSignedInDone).tap({ timeoutMs: 15_000 });
    // dismissModal can flash idle + Close before unmount; only tap when present
    // so the reporting driver does not record a failed step after Done unmounts.
    if (await this.ui.get(Handles.authModalClose).isVisible()) {
      await this.ui.get(Handles.authModalClose).tap({ timeoutMs: 1000 });
    }
  }

  async signOut(): Promise<void> {
    await this.ui.get(Handles.accountSignOut).tap();
    await this.ui.get(Handles.authSignOutConfirm).tap();
    await this.ui
      .get(Handles.authSignedOut)
      .expect.visible({ timeoutMs: 15_000 });
  }

  async expectSignedOut(): Promise<void> {
    await this.ui.get(Handles.authSignedOut).expect.visible();
  }

  /** Leave Account stack for the tab shell (Profile tab visible again). */
  async returnToTabs(): Promise<void> {
    await this.ui.get(Handles.navBack).tap();
    await this.ui.get(Handles.tabProfile).expect.visible();
  }
}
