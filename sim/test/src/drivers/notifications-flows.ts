import { Handles } from '@libs/dst-handles';
import type { Driver } from '@pkgs/ui-testing';

const WAIT_MS = 2_000;
const HIDDEN_MS = 5_000;

export class NotificationsFlows {
  constructor(private readonly ui: Driver) {}

  async openTab(): Promise<void> {
    await this.ui.tap(Handles.tabNotifications);
  }

  async expectIncomingFriendRequest(fromUsername: string): Promise<void> {
    await this.openTab();
    await this.ui.expect.visible(
      Handles.notificationsFriendRequestCard(fromUsername),
      { timeoutMs: WAIT_MS }
    );
  }

  async acceptFriendRequest(fromUsername: string): Promise<void> {
    await this.expectIncomingFriendRequest(fromUsername);
    await this.ui.tap(Handles.notificationsFriendRequestCard(fromUsername), {
      timeoutMs: WAIT_MS,
    });
    const accept = Handles.notificationsFriendRequestAccept(fromUsername);
    await this.ui.tap(accept, { timeoutMs: WAIT_MS });
    // Wait for the mutation button to finish (modal closes) so sync can settle
    // before the next actor assertion.
    await this.ui.expect.hidden(accept, { timeoutMs: HIDDEN_MS });
    await this.ui.expect.hidden(
      Handles.notificationsFriendRequestCard(fromUsername),
      { timeoutMs: HIDDEN_MS }
    );
  }

  async declineFriendRequest(fromUsername: string): Promise<void> {
    await this.expectIncomingFriendRequest(fromUsername);
    await this.ui.tap(Handles.notificationsFriendRequestCard(fromUsername), {
      timeoutMs: WAIT_MS,
    });
    const decline = Handles.notificationsFriendRequestDecline(fromUsername);
    await this.ui.tap(decline, { timeoutMs: WAIT_MS });
    await this.ui.expect.hidden(decline, { timeoutMs: HIDDEN_MS });
    await this.ui.expect.hidden(
      Handles.notificationsFriendRequestCard(fromUsername),
      { timeoutMs: HIDDEN_MS }
    );
  }
}
