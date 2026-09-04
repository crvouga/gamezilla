import { Handles } from '@libs/test-ids';

import type { ActorScript } from './actor-script';

/** Virtual-time budget for a search hit to hydrate and render. */
const WAIT_MS = 10_000;

export class SearchFlows {
  constructor(private readonly actor: ActorScript) {}

  async openTab(): Promise<void> {
    await this.actor.ui.get(Handles.tabSearch).tap();
    await this.actor.ui
      .get(Handles.searchInput)
      .expect.visible({ timeoutMs: WAIT_MS });
  }

  async searchUsername(username: string): Promise<void> {
    await this.openTab();
    const input = this.actor.ui.get(Handles.searchInput);
    await input.clear();
    await input.input(username);
  }

  /**
   * Type the query once, then poll visibility. Re-typing every tick cancels
   * the 300ms debounce and clears results before they can be observed.
   */
  private async waitForSearchHit(
    username: string,
    handles: readonly string[],
    description: string
  ): Promise<string> {
    let queried = false;
    return this.actor.pollUntil(
      async () => {
        if (!queried) {
          await this.searchUsername(username);
          queried = true;
        }
        for (const handle of handles) {
          if (await this.actor.ui.get(handle).isVisible()) return handle;
        }
        return null;
      },
      { maxMs: WAIT_MS, stepMs: 500, description }
    );
  }

  async expectUserVisible(username: string): Promise<void> {
    await this.waitForSearchHit(
      username,
      [
        Handles.friendAdd(username),
        Handles.friendConfirm(username),
        Handles.friendStatusFriends(username),
      ],
      `user ${username} visible in search`
    );
  }

  async addFriend(username: string): Promise<void> {
    const handle = Handles.friendAdd(username);
    await this.waitForSearchHit(username, [handle], handle);
    await this.actor.ui.get(handle).tap();
  }

  async expectIncomingRequest(username: string): Promise<void> {
    const handle = Handles.friendConfirm(username);
    await this.waitForSearchHit(username, [handle], handle);
  }

  async confirmFriend(username: string): Promise<void> {
    await this.expectIncomingRequest(username);
    await this.actor.ui.get(Handles.friendConfirm(username)).tap();
  }

  async expectFriendsStatus(username: string): Promise<void> {
    await this.searchUsername(username);
    await this.actor.ui
      .get(Handles.friendStatusFriends(username))
      .expect.visible({ timeoutMs: WAIT_MS });
  }
}
