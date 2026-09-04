import { Handles } from '@libs/test-ids';
import type { Driver } from '@pkgs/ui-testing';

const WAIT_MS = 10_000;
const HIDDEN_MS = 5_000;

export class NotificationsFlows {
  constructor(private readonly ui: Driver) {}

  async openTab(): Promise<void> {
    await this.ui.get(Handles.tabNotifications).tap();
  }

  async expectIncomingFriendRequest(fromUsername: string): Promise<void> {
    await this.openTab();
    await this.ui
      .get(Handles.notificationsFriendRequestCard(fromUsername))
      .expect.visible({ timeoutMs: WAIT_MS });
  }

  async acceptFriendRequest(fromUsername: string): Promise<void> {
    await this.expectIncomingFriendRequest(fromUsername);
    await this.ui
      .get(Handles.notificationsFriendRequestCard(fromUsername))
      .tap({ timeoutMs: WAIT_MS });
    const accept = Handles.notificationsFriendRequestAccept(fromUsername);
    await this.ui.get(accept).tap({ timeoutMs: WAIT_MS });
    // Wait for the mutation button to finish (modal closes) so sync can settle
    // before the next actor assertion.
    await this.ui.get(accept).expect.hidden({ timeoutMs: HIDDEN_MS });
    await this.ui
      .get(Handles.notificationsFriendRequestCard(fromUsername))
      .expect.hidden({ timeoutMs: HIDDEN_MS });
  }

  async declineFriendRequest(fromUsername: string): Promise<void> {
    await this.expectIncomingFriendRequest(fromUsername);
    await this.ui
      .get(Handles.notificationsFriendRequestCard(fromUsername))
      .tap({ timeoutMs: WAIT_MS });
    const decline = Handles.notificationsFriendRequestDecline(fromUsername);
    await this.ui.get(decline).tap({ timeoutMs: WAIT_MS });
    await this.ui.get(decline).expect.hidden({ timeoutMs: HIDDEN_MS });
    await this.ui
      .get(Handles.notificationsFriendRequestCard(fromUsername))
      .expect.hidden({ timeoutMs: HIDDEN_MS });
  }
}
