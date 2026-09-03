import type { Run } from '@pkgs/dst';
import type { Driver } from '@pkgs/ui-testing';

import { spawnActor } from '../scenario/actions';
import type { ProductSurface } from '../scenario/surface';
import { createCheckpointDriver } from '../setup/checkpoint-driver';
import { productOf } from '../setup/open-sim';
import { AuthFlows } from './auth-flows';
import { ChessFlows } from './chess-flows';
import { FriendsFlows } from './friends-flows';
import { NotificationsFlows } from './notifications-flows';
import { ProfileFlows } from './profile-flows';
import { SearchFlows } from './search-flows';
import { SpaceFlows } from './space-flows';

/** Product UI flows for one sim actor. */
export class AppDriver {
  readonly auth: AuthFlows;
  readonly profile: ProfileFlows;
  readonly search: SearchFlows;
  readonly notifications: NotificationsFlows;
  readonly friends: FriendsFlows;
  readonly space: SpaceFlows;
  readonly chess: ChessFlows;

  private constructor(ui: Driver) {
    this.auth = new AuthFlows(ui);
    this.profile = new ProfileFlows(ui);
    this.search = new SearchFlows(ui);
    this.notifications = new NotificationsFlows(ui);
    this.friends = new FriendsFlows(ui);
    this.space = new SpaceFlows(ui);
    this.chess = new ChessFlows(ui, this.space);
  }

  static async forActor(
    run: Run<ProductSurface>,
    actorId: string
  ): Promise<AppDriver> {
    if (!productOf(run).actors.has(actorId)) {
      await run.apply(spawnActor, actorId);
    }
    const handle = productOf(run).actors.get(actorId);
    if (handle === undefined) {
      throw new Error(`AppDriver: actor '${actorId}' missing after spawn`);
    }
    return new AppDriver(createCheckpointDriver(run, actorId, handle.ui));
  }
}
