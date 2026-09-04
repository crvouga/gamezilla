import { Handles } from '@libs/test-ids';

import type { ActorScript } from './actor-script';

const SCREEN_SPACES = 'screen-spaces';
const SCREEN_SPACE_JOIN = 'screen-space-join';
const SCREEN_SPACE_ENDED = 'screen-space-ended';

/** Virtual-time budget for lobby / chrome hydration. */
const WAIT_MS = 10_000;
const HIDDEN_MS = 5_000;

export class SpaceFlows {
  constructor(private readonly actor: ActorScript) {}

  private get ui() {
    return this.actor.ui;
  }

  async openTab(): Promise<void> {
    await this.ui.get(Handles.tabSpaces).tap({ timeoutMs: WAIT_MS });
    await this.ui.get(SCREEN_SPACES).expect.visible({ timeoutMs: WAIT_MS });
  }

  async createSpace(): Promise<void> {
    await this.openTab();
    await this.ui.get(Handles.spaceCreate).tap({ timeoutMs: WAIT_MS });
    await this.expectActiveSpace();
  }

  async expectLobbyCard(hostUsername: string): Promise<void> {
    await this.waitForLobbyCard(hostUsername);
  }

  async openLobbyCard(
    hostUsername: string,
    opts?: { readonly expectJoinPrompt?: boolean }
  ): Promise<void> {
    const handle = await this.waitForLobbyCard(hostUsername);
    await this.ui.get(handle).tap({ timeoutMs: WAIT_MS });
    if (opts?.expectJoinPrompt !== false) {
      await this.ui
        .get(SCREEN_SPACE_JOIN)
        .expect.visible({ timeoutMs: WAIT_MS });
    }
  }

  async reenterActiveSpace(hostUsername: string): Promise<void> {
    if (await this.ui.get(Handles.spaceClose).isVisible()) {
      await this.expectActiveSpace();
      return;
    }
    await this.openTab();
    await this.openLobbyCard(hostUsername, { expectJoinPrompt: false });
    await this.expectActiveSpace();
  }

  async joinFromPrompt(): Promise<void> {
    await this.ui.get(Handles.spaceJoin).tap({ timeoutMs: WAIT_MS });
    await this.expectActiveSpace();
  }

  async expectActiveSpace(): Promise<void> {
    await this.ui
      .get(Handles.spaceClose)
      .expect.visible({ timeoutMs: WAIT_MS });
  }

  async returnToLobby(): Promise<void> {
    await this.ui.get(Handles.spaceClose).tap({ timeoutMs: WAIT_MS });
    await this.ui.get(SCREEN_SPACES).expect.visible({ timeoutMs: WAIT_MS });
  }

  async ensureLobby(): Promise<void> {
    if (await this.ui.get(Handles.spaceClose).isVisible()) {
      await this.returnToLobby();
      return;
    }
    if (!(await this.ui.get(SCREEN_SPACES).isVisible())) {
      await this.openTab();
    }
  }

  async expectNotInActiveSpace(): Promise<void> {
    await this.ui.get(Handles.spaceMiniplayer).expect.hidden({
      timeoutMs: HIDDEN_MS,
    });
    await this.ui.get(Handles.spaceLeave).expect.hidden({ timeoutMs: WAIT_MS });
    await this.ui.get(Handles.spaceClose).expect.hidden({ timeoutMs: WAIT_MS });
  }

  async leaveSpace(): Promise<void> {
    await this.tapChromeAction(Handles.spaceLeave);
    await this.confirmMutation(Handles.spaceLeaveConfirm);
  }

  async endSpace(): Promise<void> {
    await this.tapChromeAction(Handles.spaceEnd);
    await this.confirmMutation(Handles.spaceEndConfirm);
    await this.ui
      .get(SCREEN_SPACE_ENDED)
      .expect.visible({ timeoutMs: WAIT_MS });
  }

  async expectEndedSpace(): Promise<void> {
    await this.ui
      .get(SCREEN_SPACE_ENDED)
      .expect.visible({ timeoutMs: WAIT_MS });
  }

  async expectJoinPrompt(): Promise<void> {
    await this.ui.get(SCREEN_SPACE_JOIN).expect.visible({ timeoutMs: WAIT_MS });
  }

  async expectLobbyCardGone(hostUsername: string): Promise<void> {
    await this.openTab();
    await this.ui.get(Handles.spaceCard(hostUsername)).expect.hidden({
      timeoutMs: HIDDEN_MS,
    });
  }

  private async tapChromeAction(handle: string): Promise<void> {
    await this.ui.get(handle).expect.visible({ timeoutMs: WAIT_MS });
    await this.ui.get(handle).tap({ timeoutMs: WAIT_MS });
  }

  private async confirmMutation(submitHandle: string): Promise<void> {
    await this.ui.get(submitHandle).tap({ timeoutMs: WAIT_MS });
    await this.ui.get(submitHandle).expect.hidden({ timeoutMs: HIDDEN_MS });
    await this.ui.get(Handles.spaceMutationDismiss).tap({ timeoutMs: WAIT_MS });
    await this.ui.get(Handles.spaceMutationDismiss).expect.hidden({
      timeoutMs: HIDDEN_MS,
    });
  }

  private async waitForLobbyCard(hostUsername: string): Promise<string> {
    const handle = Handles.spaceCard(hostUsername);
    let opened = false;
    return this.actor.pollUntil(
      async () => {
        if (!opened) {
          await this.openTab();
          opened = true;
        }
        if (await this.ui.get(handle).isVisible()) return handle;
        opened = false;
        return null;
      },
      { maxMs: WAIT_MS, description: `lobby card ${handle}` }
    );
  }
}
