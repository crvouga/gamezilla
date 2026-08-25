import { Handles } from '@libs/dst-handles';
import { wallClock } from '@pkgs/clock';
import type { Driver } from '@pkgs/ui-testing';

/** Fail-fast wall backstop; drain pump advances sim time between checks. */
const WAIT_MS = 2_000;

export class SearchFlows {
  constructor(private readonly ui: Driver) {}

  async openTab(): Promise<void> {
    await this.ui.tap(Handles.tabSearch);
    await this.ui.expect.visible(Handles.searchInput, { timeoutMs: WAIT_MS });
  }

  async searchUsername(username: string): Promise<void> {
    await this.openTab();
    await this.ui.clear(Handles.searchInput);
    await this.ui.input(Handles.searchInput, username);
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
        if (await this.ui.isVisible(handle)) {
          return handle;
        }
      }
      const primary = handles[0];
      if (primary === undefined) {
        throw new Error(`Timed out waiting for ${opts.description}`);
      }
      try {
        // Short wait drives the drain pump (virtual time), not a 1.2s wall burn.
        await this.ui.wait(primary, 'visible', { timeoutMs: 100 });
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
    await this.ui.tap(handle);
  }

  async expectIncomingRequest(username: string): Promise<void> {
    await this.waitForSearchHit(username, [Handles.friendConfirm(username)], {
      timeoutMs: WAIT_MS,
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
      timeoutMs: WAIT_MS,
    });
  }
}
