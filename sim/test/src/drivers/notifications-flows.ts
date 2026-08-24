import { Handles } from '@libs/dst-handles';
import type { Driver } from '@pkgs/ui-testing';

export class NotificationsFlows {
  constructor(private readonly ui: Driver) {}

  async openTab(): Promise<void> {
    await this.ui.tap(Handles.tabNotifications);
  }

  async expectIncomingFriendRequest(fromUsername: string): Promise<void> {
    await this.openTab();
    await this.ui.expect.visible(
      Handles.notificationsFriendRequestCard(fromUsername),
      { timeoutMs: 45_000 }
    );
  }

  async acceptFriendRequest(fromUsername: string): Promise<void> {
    await this.expectIncomingFriendRequest(fromUsername);
    await this.ui.tap(Handles.notificationsFriendRequestCard(fromUsername), {
      timeoutMs: 15_000,
    });
    const accept = Handles.notificationsFriendRequestAccept(fromUsername);
    await this.ui.tap(accept, { timeoutMs: 15_000 });
    // Wait for the mutation button to finish (modal closes) so sync can settle
    // before the next actor assertion.
    await this.ui.expect.hidden(accept, { timeoutMs: 30_000 });
    await this.ui.expect.hidden(
      Handles.notificationsFriendRequestCard(fromUsername),
      { timeoutMs: 30_000 }
    );
  }

  async declineFriendRequest(fromUsername: string): Promise<void> {
    await this.expectIncomingFriendRequest(fromUsername);
    await this.ui.tap(Handles.notificationsFriendRequestCard(fromUsername), {
      timeoutMs: 15_000,
    });
    const decline = Handles.notificationsFriendRequestDecline(fromUsername);
    await this.ui.tap(decline, { timeoutMs: 15_000 });
    await this.ui.expect.hidden(decline, { timeoutMs: 30_000 });
    await this.ui.expect.hidden(
      Handles.notificationsFriendRequestCard(fromUsername),
      { timeoutMs: 30_000 }
    );
  }
}
