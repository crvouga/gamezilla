import { Handles } from '@libs/dst-handles';
import type { Driver } from '@pkgs/ui-testing';

const WAIT_MS = 10_000;
const HIDDEN_MS = 5_000;

export class FriendsFlows {
  constructor(private readonly ui: Driver) {}

  /** Open Profile tab (needed once before a second rntl actor mounts). */
  async openTab(): Promise<void> {
    await this.ui.get(Handles.tabProfile).tap();
    await this.ui.get(Handles.profileFriendsStats).expect.visible({
      timeoutMs: WAIT_MS,
    });
  }

  async openList(): Promise<void> {
    await this.openTab();
    await this.ui.get(Handles.profileFriendsStats).tap();
  }

  async expectFriend(username: string): Promise<void> {
    await this.ui.get(Handles.friendsListRow(username)).expect.visible({
      timeoutMs: WAIT_MS,
    });
  }

  async expectNotFriend(username: string): Promise<void> {
    await this.openList();
    await this.ui.get(Handles.friendsListRow(username)).expect.hidden({
      timeoutMs: HIDDEN_MS,
    });
  }
}
