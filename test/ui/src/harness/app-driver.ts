import { AuthFlows } from './drivers/auth-flows';
import { ProfileFlows } from './drivers/profile-flows';
import type { openSim } from './open-sim';
import type { UiPort } from './ui-port';
import { createUiTestingAdapter } from './ui-testing-adapter';

type OpenSimResult = Awaited<ReturnType<typeof openSim>>;

export class AppDriver {
  readonly auth: AuthFlows;
  readonly profile: ProfileFlows;

  private constructor(ui: UiPort) {
    this.auth = new AuthFlows(ui);
    this.profile = new ProfileFlows(ui);
  }

  static async forActor(
    sim: OpenSimResult,
    actorId: string
  ): Promise<AppDriver> {
    const actor = await sim.actor(actorId);
    return new AppDriver(createUiTestingAdapter(actor.ui));
  }
}
