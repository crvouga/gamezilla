import type { Driver } from '@pkgs/ui-testing';

import type { openSim } from '../setup/open-sim';
import { AuthFlows } from './auth-flows';
import { ProfileFlows } from './profile-flows';

type OpenSimResult = Awaited<ReturnType<typeof openSim>>;

export class AppDriver {
  readonly auth: AuthFlows;
  readonly profile: ProfileFlows;

  private constructor(ui: Driver) {
    this.auth = new AuthFlows(ui);
    this.profile = new ProfileFlows(ui);
  }

  static async forActor(
    sim: OpenSimResult,
    actorId: string
  ): Promise<AppDriver> {
    const actor = await sim.actor(actorId);
    return new AppDriver(actor.ui);
  }
}
