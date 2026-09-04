import { type Handle, Handles } from '@libs/test-ids';
import type { Driver } from '@pkgs/ui-testing';

export class ProfileFlows {
  constructor(private readonly ui: Driver) {}

  async openEdit(): Promise<void> {
    await this.ui.get(Handles.tabProfile).tap();
    await this.ui.get(Handles.profileEdit).tap();
    await this.ui.get(Handles.profileEditUsername).expect.visible();
    await this.ui.get(Handles.profileEditAvatar).expect.visible();
  }

  async setUsername(username: string): Promise<void> {
    await this.ui.get(Handles.profileEditUsername).tap();
    await this.ui.get(Handles.profileUsernameInput).input(username);
    await this.ui.get(Handles.profileUsernameSave).tap();
    await this.ui.get(Handles.profileUsernameSave).expect.text('Saved');
    await this.ui.get(Handles.profileUsernameCancel).tap();
    await this.ui.get(Handles.profileEditUsername).expect.visible();
    await this.ui.get(Handles.navBack).tap();
    await this.ui.get(Handles.profileEdit).expect.visible();
  }

  async expectUsername(username: string): Promise<void> {
    await this.ui
      .get(Handles.profileDisplayUsername)
      .expect.text(`@${username}`);
  }

  async openAvatarEditor(): Promise<void> {
    await this.ui.get(Handles.profileEditAvatar).tap();
    await this.ui.get(Handles.profileAvatarSeed).expect.visible();
    await this.ui.get(Handles.profileAvatarStyle).expect.visible();
  }

  async setAvatarSeed(seed: string): Promise<void> {
    await this.ui.get(Handles.profileAvatarSeed).input(seed);
  }

  async setAvatarStyle(styleOptionHandle: Handle): Promise<void> {
    await this.ui.get(Handles.profileAvatarStyle).tap();
    await this.ui.get(styleOptionHandle).tap();
    await this.ui.get(Handles.profileAvatarStyle).expect.visible();
  }

  async expectAvatarStyleLabel(label: string): Promise<void> {
    await this.ui.get(Handles.profileAvatarStyle).expect.text(label, {
      exact: false,
    });
  }

  async expectAvatarTraitVisible(): Promise<void> {
    await this.ui.get(Handles.profileAvatarTrait).expect.visible();
  }

  async saveAvatar(): Promise<void> {
    await this.ui.get(Handles.profileAvatarSave).tap();
    await this.ui.get(Handles.profileAvatarSave).expect.text('Saved');
  }

  async leaveAvatarEditor(): Promise<void> {
    await this.ui.get(Handles.profileAvatarCancel).tap();
    await this.ui.get(Handles.profileEditAvatar).expect.visible();
  }

  async expectAvatarSeed(seed: string): Promise<void> {
    await this.ui.get(Handles.profileAvatarSeed).expect.text(seed);
  }
}
