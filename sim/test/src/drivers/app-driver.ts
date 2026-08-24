import type { Driver } from '@pkgs/ui-testing';

import type { openSim } from '../setup/open-sim';
import { AuthFlows } from './auth-flows';
import { FriendsFlows } from './friends-flows';
import { NotificationsFlows } from './notifications-flows';
import { ProfileFlows } from './profile-flows';
import { SearchFlows } from './search-flows';
import { SpaceFlows } from './space-flows';

type OpenSimResult = Awaited<ReturnType<typeof openSim>>;

/**
 * Product UI flows for one sim actor. Dual-actor DST must {@link park} the
 * inactive actor before driving the other — RNTL only delivers text input to
 * the latest mounted tree.
 */
export class AppDriver {
  readonly auth: AuthFlows;
  readonly profile: ProfileFlows;
  readonly search: SearchFlows;
  readonly notifications: NotificationsFlows;
  readonly friends: FriendsFlows;
  readonly space: SpaceFlows;

  private constructor(private readonly ui: Driver) {
    this.auth = new AuthFlows(ui);
    this.profile = new ProfileFlows(ui);
    this.search = new SearchFlows(ui);
    this.notifications = new NotificationsFlows(ui);
    this.friends = new FriendsFlows(ui);
    this.space = new SpaceFlows(ui);
  }

  static async forActor(
    sim: OpenSimResult,
    actorId: string
  ): Promise<AppDriver> {
    const actor = await sim.actor(actorId);
    return new AppDriver(actor.ui);
  }

  /** Unmount this actor’s App so the other actor can receive text input. */
  async park(): Promise<void> {
    await this.ui.close();
  }

  /** Remount after {@link park} (same client seams / local DB). */
  async resume(): Promise<void> {
    await this.ui.launch();
  }
}
