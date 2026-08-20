import { Handles } from '@libs/dst-handles';
import type { Driver } from '@pkgs/ui-testing';

export class NotificationsFlows {
  constructor(private readonly ui: Driver) {}

  async openTab(): Promise<void> {
    await this.ui.tap(Handles.tabNotifications);
  }

  async acceptFriendRequest(fromUsername: string): Promise<void> {
    await this.openTab();
    await this.ui.tap(Handles.notificationsFriendRequestCard(fromUsername), {
      timeoutMs: 45_000,
    });
    await this.ui.tap(Handles.notificationsFriendRequestAccept(fromUsername), {
      timeoutMs: 15_000,
    });
  }
}
