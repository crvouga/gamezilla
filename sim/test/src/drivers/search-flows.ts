import { Handles } from '@libs/dst-handles';
import { wallClock } from '@pkgs/clock';
import type { Driver } from '@pkgs/ui-testing';

/** Fail-fast wall backstop; drain pump advances sim time between checks. */
const WAIT_MS = 10_000;

export class SearchFlows {
  constructor(private readonly ui: Driver) {}

  async openTab(): Promise<void> {
    await this.ui.get(Handles.tabSearch).tap();
    await this.ui
      .get(Handles.searchInput)
      .expect.visible({ timeoutMs: WAIT_MS });
  }

  async searchUsername(username: string): Promise<void> {
    await this.openTab();
    const input = this.ui.get(Handles.searchInput);
    await input.clear();
    await input.input(username);
  }

  /**
   * Wait until any of `handles` is visible. Re-queries search when none match
   * (rate limit is generous; pump drains sync between attempts).
   */
  private async waitForSearchHit(
    username: string,
    handles: readonly string[],
    opts: { readonly timeoutMs: number; readonly description: string }
  ): Promise<string> {
    const deadline = wallClock.now() + opts.timeoutMs;
    let lastError: unknown;
    let queried = false;
    while (wallClock.now() < deadline) {
      if (!queried) {
        await this.searchUsername(username);
        queried = true;
      }
      for (const handle of handles) {
        if (await this.ui.get(handle).isVisible()) {
          return handle;
        }
      }
      const primary = handles[0];
      if (primary === undefined) {
        throw new Error(`Timed out waiting for ${opts.description}`);
      }
      try {
        // Short wait drives the drain pump (virtual time), not a 1.2s wall burn.
        await this.ui.get(primary).wait('visible', { timeoutMs: 100 });
        return primary;
      } catch (error) {
        lastError = error;
        // Re-type search so a late username hydrate can appear.
        queried = false;
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
        timeoutMs: WAIT_MS,
        description: `user ${username} visible in search`,
      }
    );
  }

  async addFriend(username: string): Promise<void> {
    const handle = Handles.friendAdd(username);
    await this.waitForSearchHit(username, [handle], {
      timeoutMs: WAIT_MS,
      description: handle,
    });
    await this.ui.get(handle).tap();
  }

  async expectIncomingRequest(username: string): Promise<void> {
    await this.waitForSearchHit(username, [Handles.friendConfirm(username)], {
      timeoutMs: WAIT_MS,
      description: Handles.friendConfirm(username),
    });
  }

  async confirmFriend(username: string): Promise<void> {
    await this.expectIncomingRequest(username);
    await this.ui.get(Handles.friendConfirm(username)).tap();
  }

  async expectFriendsStatus(username: string): Promise<void> {
    await this.searchUsername(username);
    await this.ui.get(Handles.friendStatusFriends(username)).expect.visible({
      timeoutMs: WAIT_MS,
    });
  }
}
