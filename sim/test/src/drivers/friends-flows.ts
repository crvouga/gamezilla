import { Handles } from '@libs/dst-handles';
import type { Driver } from '@pkgs/ui-testing';

export class FriendsFlows {
  constructor(private readonly ui: Driver) {}

  /** Open Profile tab (needed once before a second in-process actor mounts). */
  async openTab(): Promise<void> {
    await this.ui.tap(Handles.tabProfile);
    await this.ui.expect.visible(Handles.profileFriendsStats, {
      timeoutMs: 15_000,
    });
  }

  async openList(): Promise<void> {
    await this.openTab();
    await this.ui.tap(Handles.profileFriendsStats);
  }

  async expectFriend(username: string): Promise<void> {
    await this.ui.expect.visible(Handles.friendsListRow(username), {
      timeoutMs: 20_000,
    });
  }

  async expectNotFriend(username: string): Promise<void> {
    await this.openList();
    await this.ui.expect.hidden(Handles.friendsListRow(username), {
      timeoutMs: 15_000,
    });
  }
}
