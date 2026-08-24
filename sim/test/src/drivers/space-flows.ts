import { Handles } from '@libs/dst-handles';
import { wallClock } from '@pkgs/clock';
import type { Driver } from '@pkgs/ui-testing';

const SCREEN_SPACES = 'screen-spaces';
const SCREEN_SPACE_JOIN = 'screen-space-join';
const SCREEN_SPACE_ENDED = 'screen-space-ended';

export class SpaceFlows {
  constructor(private readonly ui: Driver) {}

  async openTab(): Promise<void> {
    await this.ui.tap(Handles.tabSpaces);
    await this.ui.expect.visible(SCREEN_SPACES, { timeoutMs: 15_000 });
  }

  async createSpace(): Promise<void> {
    await this.openTab();
    await this.ui.tap(Handles.spaceCreate, { timeoutMs: 15_000 });
    await this.expectActiveSpace();
  }

  async expectLobbyCard(hostUsername: string): Promise<void> {
    await this.waitForLobbyCard(hostUsername, { timeoutMs: 60_000 });
  }

  async openLobbyCard(
    hostUsername: string,
    opts?: { readonly expectJoinPrompt?: boolean }
  ): Promise<void> {
    const handle = await this.waitForLobbyCard(hostUsername, {
      timeoutMs: 60_000,
    });
    await this.ui.tap(handle, { timeoutMs: 15_000 });
    if (opts?.expectJoinPrompt !== false) {
      await this.ui.expect.visible(SCREEN_SPACE_JOIN, { timeoutMs: 30_000 });
    }
  }

  async reenterActiveSpace(hostUsername: string): Promise<void> {
    await this.openTab();
    await this.openLobbyCard(hostUsername, { expectJoinPrompt: false });
    await this.expectActiveSpace();
  }

  async joinFromPrompt(): Promise<void> {
    await this.ui.tap(Handles.spaceJoin, { timeoutMs: 15_000 });
    await this.expectActiveSpace();
  }

  async expectActiveSpace(): Promise<void> {
    await this.ui.expect.visible(Handles.spaceClose, { timeoutMs: 60_000 });
  }

  async returnToLobby(): Promise<void> {
    await this.ui.tap(Handles.spaceClose, { timeoutMs: 15_000 });
    await this.ui.expect.visible(SCREEN_SPACES, { timeoutMs: 30_000 });
  }

  async ensureLobby(): Promise<void> {
    if (await this.ui.isVisible(Handles.spaceClose)) {
      await this.returnToLobby();
      return;
    }
    if (!(await this.ui.isVisible(SCREEN_SPACES))) {
      await this.openTab();
    }
  }

  async expectNotInActiveSpace(): Promise<void> {
    await this.ui.expect.hidden(Handles.spaceMiniplayer, { timeoutMs: 30_000 });
    await this.ui.expect.hidden(Handles.spaceLeave, { timeoutMs: 15_000 });
    await this.ui.expect.hidden(Handles.spaceClose, { timeoutMs: 15_000 });
  }

  async leaveSpace(): Promise<void> {
    await this.tapChromeAction(Handles.spaceLeave);
    await this.confirmMutation(Handles.spaceLeaveConfirm);
  }

  async endSpace(): Promise<void> {
    await this.tapChromeAction(Handles.spaceEnd);
    await this.confirmMutation(Handles.spaceEndConfirm);
    await this.ui.expect.visible(SCREEN_SPACE_ENDED, { timeoutMs: 45_000 });
  }

  async expectEndedSpace(): Promise<void> {
    await this.ui.expect.visible(SCREEN_SPACE_ENDED, { timeoutMs: 45_000 });
  }

  async expectJoinPrompt(): Promise<void> {
    await this.ui.expect.visible(SCREEN_SPACE_JOIN, { timeoutMs: 60_000 });
  }

  async expectLobbyCardGone(hostUsername: string): Promise<void> {
    await this.openTab();
    await this.ui.expect.hidden(Handles.spaceCard(hostUsername), {
      timeoutMs: 60_000,
    });
  }

  private async tapChromeAction(handle: string): Promise<void> {
    await this.ui.expect.visible(handle, { timeoutMs: 45_000 });
    await this.ui.tap(handle, { timeoutMs: 15_000 });
  }

  private async confirmMutation(submitHandle: string): Promise<void> {
    await this.ui.tap(submitHandle, { timeoutMs: 15_000 });
    await this.ui.expect.hidden(submitHandle, { timeoutMs: 45_000 });
    await this.ui.tap(Handles.spaceMutationDismiss, { timeoutMs: 15_000 });
    await this.ui.expect.hidden(Handles.spaceMutationDismiss, {
      timeoutMs: 30_000,
    });
  }

  private async waitForLobbyCard(
    hostUsername: string,
    opts: { readonly timeoutMs: number }
  ): Promise<string> {
    const handle = Handles.spaceCard(hostUsername);
    const deadline = wallClock.now() + opts.timeoutMs;
    let lastError: unknown;
    let lastRefreshAt = 0;
    while (wallClock.now() < deadline) {
      if (wallClock.now() - lastRefreshAt >= 750) {
        await this.openTab();
        lastRefreshAt = wallClock.now();
      }
      try {
        await this.ui.expect.visible(handle, { timeoutMs: 1_200 });
        return handle;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error(`Timed out waiting for lobby card ${handle}`);
  }
}
