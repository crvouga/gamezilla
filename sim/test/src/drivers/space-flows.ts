import { Handles } from '@libs/dst-handles';
import { wallClock } from '@pkgs/clock';
import type { Driver } from '@pkgs/ui-testing';

const SCREEN_SPACES = 'screen-spaces';
const SCREEN_SPACE_JOIN = 'screen-space-join';
const SCREEN_SPACE_ENDED = 'screen-space-ended';

/** Fail-fast wall backstop; drain pump advances sim time between checks. */
const WAIT_MS = 2_000;
const HIDDEN_MS = 5_000;

export class SpaceFlows {
  constructor(private readonly ui: Driver) {}

  async openTab(): Promise<void> {
    await this.ui.tap(Handles.tabSpaces, { timeoutMs: WAIT_MS });
    await this.ui.expect.visible(SCREEN_SPACES, { timeoutMs: WAIT_MS });
  }

  async createSpace(): Promise<void> {
    await this.openTab();
    await this.ui.tap(Handles.spaceCreate, { timeoutMs: WAIT_MS });
    await this.expectActiveSpace();
  }

  async expectLobbyCard(hostUsername: string): Promise<void> {
    await this.waitForLobbyCard(hostUsername, { timeoutMs: WAIT_MS });
  }

  async openLobbyCard(
    hostUsername: string,
    opts?: { readonly expectJoinPrompt?: boolean }
  ): Promise<void> {
    const handle = await this.waitForLobbyCard(hostUsername, {
      timeoutMs: WAIT_MS,
    });
    await this.ui.tap(handle, { timeoutMs: WAIT_MS });
    if (opts?.expectJoinPrompt !== false) {
      await this.ui.expect.visible(SCREEN_SPACE_JOIN, { timeoutMs: WAIT_MS });
    }
  }

  async reenterActiveSpace(hostUsername: string): Promise<void> {
    if (await this.ui.isVisible(Handles.spaceClose)) {
      await this.expectActiveSpace();
      return;
    }
    await this.openTab();
    await this.openLobbyCard(hostUsername, { expectJoinPrompt: false });
    await this.expectActiveSpace();
  }

  async joinFromPrompt(): Promise<void> {
    await this.ui.tap(Handles.spaceJoin, { timeoutMs: WAIT_MS });
    await this.expectActiveSpace();
  }

  async expectActiveSpace(): Promise<void> {
    await this.ui.expect.visible(Handles.spaceClose, { timeoutMs: WAIT_MS });
  }

  async returnToLobby(): Promise<void> {
    await this.ui.tap(Handles.spaceClose, { timeoutMs: WAIT_MS });
    await this.ui.expect.visible(SCREEN_SPACES, { timeoutMs: WAIT_MS });
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
    await this.ui.expect.hidden(Handles.spaceMiniplayer, {
      timeoutMs: HIDDEN_MS,
    });
    await this.ui.expect.hidden(Handles.spaceLeave, { timeoutMs: WAIT_MS });
    await this.ui.expect.hidden(Handles.spaceClose, { timeoutMs: WAIT_MS });
  }

  async leaveSpace(): Promise<void> {
    await this.tapChromeAction(Handles.spaceLeave);
    await this.confirmMutation(Handles.spaceLeaveConfirm);
  }

  async endSpace(): Promise<void> {
    await this.tapChromeAction(Handles.spaceEnd);
    await this.confirmMutation(Handles.spaceEndConfirm);
    await this.ui.expect.visible(SCREEN_SPACE_ENDED, { timeoutMs: WAIT_MS });
  }

  async expectEndedSpace(): Promise<void> {
    await this.ui.expect.visible(SCREEN_SPACE_ENDED, { timeoutMs: WAIT_MS });
  }

  async expectJoinPrompt(): Promise<void> {
    await this.ui.expect.visible(SCREEN_SPACE_JOIN, { timeoutMs: WAIT_MS });
  }

  async expectLobbyCardGone(hostUsername: string): Promise<void> {
    await this.openTab();
    await this.ui.expect.hidden(Handles.spaceCard(hostUsername), {
      timeoutMs: HIDDEN_MS,
    });
  }

  private async tapChromeAction(handle: string): Promise<void> {
    await this.ui.expect.visible(handle, { timeoutMs: WAIT_MS });
    await this.ui.tap(handle, { timeoutMs: WAIT_MS });
  }

  private async confirmMutation(submitHandle: string): Promise<void> {
    await this.ui.tap(submitHandle, { timeoutMs: WAIT_MS });
    await this.ui.expect.hidden(submitHandle, { timeoutMs: HIDDEN_MS });
    await this.ui.tap(Handles.spaceMutationDismiss, { timeoutMs: WAIT_MS });
    await this.ui.expect.hidden(Handles.spaceMutationDismiss, {
      timeoutMs: HIDDEN_MS,
    });
  }

  private async waitForLobbyCard(
    hostUsername: string,
    opts: { readonly timeoutMs: number }
  ): Promise<string> {
    const handle = Handles.spaceCard(hostUsername);
    const deadline = wallClock.now() + opts.timeoutMs;
    let lastError: unknown;
    let opened = false;
    while (wallClock.now() < deadline) {
      if (!opened) {
        await this.openTab();
        opened = true;
      }
      if (await this.ui.isVisible(handle)) {
        return handle;
      }
      try {
        await this.ui.wait(handle, 'visible', { timeoutMs: 100 });
        return handle;
      } catch (error) {
        lastError = error;
        opened = false;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error(`Timed out waiting for lobby card ${handle}`);
  }
}
