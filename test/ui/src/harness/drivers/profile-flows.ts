import { Handles } from '@libs/dst-handles';

import type { UiPort } from '../ui-port';

export class ProfileFlows {
  constructor(private readonly ui: UiPort) {}

  async openEdit(): Promise<void> {
    await this.ui.tap(Handles.tabProfile);
    await this.ui.tap(Handles.profileEdit);
    await this.ui.expectVisible(Handles.profileEditUsername);
    await this.ui.expectVisible(Handles.profileEditAvatar);
  }

  async setUsername(username: string): Promise<void> {
    await this.ui.tap(Handles.profileEditUsername);
    await this.ui.input(Handles.profileUsernameInput, username);
    await this.ui.tap(Handles.profileUsernameSave);
    await this.ui.expectCopy(Handles.profileUsernameSave, 'Saved');
    await this.ui.tap(Handles.profileUsernameCancel);
    await this.ui.expectVisible(Handles.profileEditUsername);
    await this.ui.tap(Handles.navBack);
    await this.ui.expectVisible(Handles.profileEdit);
  }

  async expectUsername(username: string): Promise<void> {
    await this.ui.expectText(Handles.profileDisplayUsername, `@${username}`);
  }

  async setAvatarSeed(seed: string): Promise<void> {
    await this.ui.tap(Handles.profileEditAvatar);
    await this.ui.input(Handles.profileAvatarSeed, seed);
    await this.ui.tap(Handles.profileAvatarSave);
    await this.ui.expectCopy(Handles.profileAvatarSave, 'Saved');
    await this.ui.tap(Handles.profileAvatarCancel);
    await this.ui.expectVisible(Handles.profileEditAvatar);
  }

  async expectAvatarSeed(seed: string): Promise<void> {
    await this.ui.tap(Handles.profileEditAvatar);
    await this.ui.expectVisible(Handles.profileAvatarSeed);
    await this.ui.expectText(Handles.profileAvatarSeed, seed);
  }
}
