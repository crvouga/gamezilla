import type { Run } from '@pkgs/dst';

import { spawnActor } from '../scenario/actions';
import { actorIds } from '../scenario/observations';
import type { ProductSurface } from '../scenario/surface';
import { ActorRun } from './actor-run';
import { AuthFlows } from './auth-flows';
import { ChessFlows } from './chess-flows';
import { FriendsFlows } from './friends-flows';
import { NotificationsFlows } from './notifications-flows';
import { ProfileFlows } from './profile-flows';
import { SearchFlows } from './search-flows';
import { SpaceFlows } from './space-flows';

/** Product UI flows for one sim actor, spoken entirely through the run. */
export class AppDriver {
  readonly run: Run<ProductSurface>;
  readonly actorId: string;
  readonly auth: AuthFlows;
  readonly profile: ProfileFlows;
  readonly search: SearchFlows;
  readonly notifications: NotificationsFlows;
  readonly friends: FriendsFlows;
  readonly space: SpaceFlows;
  readonly chess: ChessFlows;

  private constructor(actor: ActorRun) {
    this.run = actor.run;
    this.actorId = actor.actorId;
    this.auth = new AuthFlows(actor.ui);
    this.profile = new ProfileFlows(actor.ui);
    this.search = new SearchFlows(actor);
    this.notifications = new NotificationsFlows(actor.ui);
    this.friends = new FriendsFlows(actor.ui);
    this.space = new SpaceFlows(actor);
    this.chess = new ChessFlows(actor, this.space);
  }

  static async forActor(
    run: Run<ProductSurface>,
    actorId: string
  ): Promise<AppDriver> {
    const ids = await run.observe(actorIds);
    if (!ids.includes(actorId)) {
      await run.apply(spawnActor, actorId);
    }
    return new AppDriver(new ActorRun(run, actorId));
  }
}
