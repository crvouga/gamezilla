import type { Script } from '@pkgs/dst';

import { spawnActor } from '../scenario/actions';
import { actorIds } from '../scenario/observations';
import type { ProductSurface } from '../scenario/surface';
import { ActorScript } from './actor-script';
import { AuthFlows } from './auth-flows';
import { ChessFlows } from './chess-flows';
import { FriendsFlows } from './friends-flows';
import { NotificationsFlows } from './notifications-flows';
import { ProfileFlows } from './profile-flows';
import { SearchFlows } from './search-flows';
import { SpaceFlows } from './space-flows';

/** Product UI flows for one sim actor, spoken entirely through the run. */
export class AppDriver {
  readonly s: Script<ProductSurface>;
  readonly actorId: string;
  readonly auth: AuthFlows;
  readonly profile: ProfileFlows;
  readonly search: SearchFlows;
  readonly notifications: NotificationsFlows;
  readonly friends: FriendsFlows;
  readonly space: SpaceFlows;
  readonly chess: ChessFlows;

  private constructor(actor: ActorScript) {
    this.s = actor.s;
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
    s: Script<ProductSurface>,
    actorId: string
  ): Promise<AppDriver> {
    const ids = await s.observe(actorIds);
    if (!ids.includes(actorId)) {
      await s.apply(spawnActor, actorId);
    }
    return new AppDriver(new ActorScript(s, actorId));
  }
}
