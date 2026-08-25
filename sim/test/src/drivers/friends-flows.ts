import { Handles } from '@libs/dst-handles';
import type { Driver } from '@pkgs/ui-testing';

const WAIT_MS = 2_000;
const HIDDEN_MS = 5_000;

export class FriendsFlows {
  constructor(private readonly ui: Driver) {}

  /** Open Profile tab (needed once before a second rntl actor mounts). */
  async openTab(): Promise<void> {
    await this.ui.tap(Handles.tabProfile);
    await this.ui.expect.visible(Handles.profileFriendsStats, {
      timeoutMs: WAIT_MS,
    });
  }

  async openList(): Promise<void> {
    await this.openTab();
    await this.ui.tap(Handles.profileFriendsStats);
  }

  async expectFriend(username: string): Promise<void> {
    await this.ui.expect.visible(Handles.friendsListRow(username), {
      timeoutMs: WAIT_MS,
    });
  }

  async expectNotFriend(username: string): Promise<void> {
    await this.openList();
    await this.ui.expect.hidden(Handles.friendsListRow(username), {
      timeoutMs: HIDDEN_MS,
    });
  }
}
