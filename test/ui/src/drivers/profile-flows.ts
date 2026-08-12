import { type Handle, Handles } from '@libs/dst-handles';
import type { Driver } from '@pkgs/ui-testing';

export class ProfileFlows {
  constructor(private readonly ui: Driver) {}

  async openEdit(): Promise<void> {
    await this.ui.tap(Handles.tabProfile);
    await this.ui.tap(Handles.profileEdit);
    await this.ui.expect.visible(Handles.profileEditUsername);
    await this.ui.expect.visible(Handles.profileEditAvatar);
  }

  async setUsername(username: string): Promise<void> {
    await this.ui.tap(Handles.profileEditUsername);
    await this.ui.input(Handles.profileUsernameInput, username);
    await this.ui.tap(Handles.profileUsernameSave);
    await this.ui.expect.text(Handles.profileUsernameSave, 'Saved');
    await this.ui.tap(Handles.profileUsernameCancel);
    await this.ui.expect.visible(Handles.profileEditUsername);
    await this.ui.tap(Handles.navBack);
    await this.ui.expect.visible(Handles.profileEdit);
  }

  async expectUsername(username: string): Promise<void> {
    await this.ui.expect.text(Handles.profileDisplayUsername, `@${username}`);
  }

  async openAvatarEditor(): Promise<void> {
    await this.ui.tap(Handles.profileEditAvatar);
    await this.ui.expect.visible(Handles.profileAvatarSeed);
    await this.ui.expect.visible(Handles.profileAvatarStyle);
  }

  async setAvatarSeed(seed: string): Promise<void> {
    await this.ui.input(Handles.profileAvatarSeed, seed);
  }

  async setAvatarStyle(styleOptionHandle: Handle): Promise<void> {
    await this.ui.tap(Handles.profileAvatarStyle);
    await this.ui.tap(styleOptionHandle);
    await this.ui.expect.visible(Handles.profileAvatarStyle);
  }

  async expectAvatarStyleLabel(label: string): Promise<void> {
    await this.ui.expect.text(Handles.profileAvatarStyle, label, {
      exact: false,
    });
  }

  async expectAvatarTraitVisible(): Promise<void> {
    await this.ui.expect.visible(Handles.profileAvatarTrait);
  }

  async saveAvatar(): Promise<void> {
    await this.ui.tap(Handles.profileAvatarSave);
    await this.ui.expect.text(Handles.profileAvatarSave, 'Saved');
  }

  async leaveAvatarEditor(): Promise<void> {
    await this.ui.tap(Handles.profileAvatarCancel);
    await this.ui.expect.visible(Handles.profileEditAvatar);
  }

  async expectAvatarSeed(seed: string): Promise<void> {
    await this.ui.expect.text(Handles.profileAvatarSeed, seed);
  }
}
