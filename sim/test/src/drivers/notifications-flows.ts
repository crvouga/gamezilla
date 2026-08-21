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
    const accept = Handles.notificationsFriendRequestAccept(fromUsername);
    await this.ui.tap(accept, { timeoutMs: 15_000 });
    // Wait for the mutation button to finish (modal closes) before park/resume
    // so Alice's connect wake cannot snapshot pre-accept friendships.
    await this.ui.expect.hidden(accept, { timeoutMs: 30_000 });
  }
}
