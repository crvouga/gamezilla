import { Handles } from '@libs/dst-handles';
import { wallClock } from '@pkgs/clock';
import type { Driver } from '@pkgs/ui-testing';

export class SearchFlows {
  constructor(private readonly ui: Driver) {}

  async openTab(): Promise<void> {
    await this.ui.tap(Handles.tabSearch);
    await this.ui.expect.visible(Handles.searchInput, { timeoutMs: 15_000 });
  }

  async searchUsername(username: string): Promise<void> {
    await this.openTab();
    await this.ui.clear(Handles.searchInput);
    await this.ui.input(Handles.searchInput, username);
  }

  /**
   * Re-query infrequently so username upload can land without burning the
   * friend-search rate limit.
   */
  private async waitForSearchHit(
    username: string,
    handles: readonly string[],
    opts: { readonly timeoutMs: number; readonly description: string }
  ): Promise<string> {
    const deadline = wallClock.now() + opts.timeoutMs;
    let lastError: unknown;
    let lastQueryAt = 0;
    while (wallClock.now() < deadline) {
      if (wallClock.now() - lastQueryAt >= 750) {
        await this.searchUsername(username);
        lastQueryAt = wallClock.now();
      }
      for (const handle of handles) {
        try {
          await this.ui.expect.visible(handle, { timeoutMs: 1_200 });
          return handle;
        } catch (error) {
          lastError = error;
        }
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error(`Timed out waiting for ${opts.description}`);
  }

  async expectUserVisible(username: string): Promise<void> {
    await this.waitForSearchHit(
      username,
      [
        Handles.friendAdd(username),
        Handles.friendConfirm(username),
        Handles.friendStatusFriends(username),
      ],
      {
        timeoutMs: 60_000,
        description: `user ${username} visible in search`,
      }
    );
  }

  async addFriend(username: string): Promise<void> {
    const handle = Handles.friendAdd(username);
    await this.waitForSearchHit(username, [handle], {
      timeoutMs: 60_000,
      description: handle,
    });
    await this.ui.tap(handle);
  }

  async expectIncomingRequest(username: string): Promise<void> {
    await this.waitForSearchHit(username, [Handles.friendConfirm(username)], {
      timeoutMs: 60_000,
      description: Handles.friendConfirm(username),
    });
  }

  async confirmFriend(username: string): Promise<void> {
    await this.expectIncomingRequest(username);
    await this.ui.tap(Handles.friendConfirm(username));
  }

  async expectFriendsStatus(username: string): Promise<void> {
    await this.searchUsername(username);
    await this.ui.expect.visible(Handles.friendStatusFriends(username), {
      timeoutMs: 20_000,
    });
  }
}
