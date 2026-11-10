import type {
  LiveActivity,
  LiveFrame,
  LiveHeartbeat,
  LiveHeartbeatAnswer,
  LiveKind,
  LivePlace,
  OnlineNowFilter,
} from '@libs/observatory-shared-ts/live-session';
import { ProfileReadRepository } from '@libs/profile-shared-ts/read-profile';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import {
  type LiveDevice,
  type LiveSessionRow,
  LiveSessions,
} from './live-sessions';
import type { ObservatoryPorts } from './ports';

/** One app online now, as the User Observatory lists it. */
export type OnlineNowEntry = {
  readonly sessionId: string;
  readonly kind: LiveKind;
  /** The Synthetic User's own id, for its control panel; `null` for a person. */
  readonly syntheticUserId: string | null;
  /** A paused Synthetic User starts no new activity; never set for a person. */
  readonly paused: boolean;
  readonly username: string;
  readonly avatarConfig: string | null;
  readonly accountId: string;
  readonly place: LivePlace;
  readonly activity: LiveActivity;
  readonly game: string | null;
  readonly heartbeatAtMs: number;
};

/** What a watcher sees of someone online now, or that they have left. */
export type LiveWatchView =
  | {
      readonly online: true;
      readonly entry: OnlineNowEntry;
      readonly frame: LiveFrame | null;
    }
  | { readonly online: false };

const SHOWN: Readonly<Record<OnlineNowFilter, (kind: LiveKind) => boolean>> = {
  everyone: () => true,
  people: (kind) => kind === 'person',
  synthetic: (kind) => kind === 'synthetic',
};

/**
 * Who is online now and what each one's screen shows: the use case behind
 * the app's live-session reporter and the User Observatory. Whether an app
 * belongs to a Synthetic User is the Synthetic Population's to say; the app
 * never says.
 */
export class UserObservatory {
  constructor(
    private readonly db: SqlClient,
    private readonly ports: ObservatoryPorts
  ) {}

  private async entries(
    rows: readonly LiveSessionRow[]
  ): Promise<OnlineNowEntry[]> {
    const accounts = [...new Set(rows.map((row) => row.account_id))];
    const cards = await new ProfileReadRepository(this.db).readCardsByIds(
      accounts
    );
    const byId = new Map(cards.map((card) => [card.userId, card]));
    const synthetic = await this.ports.population.syntheticUsersOf(
      this.db,
      accounts
    );
    return rows.map((row) => {
      const user = synthetic.get(row.account_id) ?? null;
      return {
        sessionId: row.id,
        kind: user === null ? 'person' : 'synthetic',
        syntheticUserId: user?.id ?? null,
        paused: user?.paused ?? false,
        username: byId.get(row.account_id)?.username ?? '',
        avatarConfig: byId.get(row.account_id)?.avatarConfig ?? null,
        accountId: row.account_id,
        place: row.place as LivePlace,
        activity: row.activity as LiveActivity,
        game: row.game,
        heartbeatAtMs: new Date(row.heartbeat_at).getTime(),
      };
    });
  }

  async heartbeat(
    device: LiveDevice,
    value: LiveHeartbeat
  ): Promise<LiveHeartbeatAnswer> {
    const { changed, watched } = await this.db.transaction(async (tx) => {
      const sessions = new LiveSessions(tx, this.ports);
      return {
        changed: await sessions.heartbeat(device, value),
        watched: await sessions.watched(device),
      };
    });
    if (changed) await this.ports.presenceChanged();
    return { watched };
  }

  async end(device: LiveDevice): Promise<void> {
    const ended = await this.db.transaction((tx) =>
      new LiveSessions(tx, this.ports).end(device)
    );
    if (ended) await this.ports.presenceChanged();
  }

  async frame(device: LiveDevice, value: LiveFrame): Promise<boolean> {
    const sessionId = await this.db.transaction((tx) =>
      new LiveSessions(tx, this.ports).frame(device, value)
    );
    if (sessionId !== null) await this.ports.frameChanged(sessionId);
    return sessionId !== null;
  }

  /** Everyone online now, people or Synthetic Users as `filter` chooses. */
  async onlineNow(filter: OnlineNowFilter): Promise<OnlineNowEntry[]> {
    const rows = await new LiveSessions(this.db, this.ports).onlineNow();
    return (await this.entries(rows)).filter((entry) =>
      SHOWN[filter](entry.kind)
    );
  }

  /**
   * The watcher looks at someone's screen: keeps the watch going and, when
   * it starts one, records who watched whom and tells the watched app.
   */
  async watch(sessionId: string, watcherId: string): Promise<LiveWatchView> {
    const result = await this.db.transaction(async (tx) => {
      const sessions = new LiveSessions(tx, this.ports);
      const session = await sessions.session(sessionId);
      if (session === null) return null;
      const started = await sessions.watch({
        accountId: session.account_id,
        deviceId: session.device_id,
      });
      if (started)
        await this.ports.population.recordWatchStarted(tx, {
          actorId: watcherId,
          sessionId,
          watchedAccountId: session.account_id,
        });
      return { session, started };
    });
    if (result === null) return { online: false };
    if (result.started) await this.ports.wakeAccount(result.session.account_id);
    const [entry] = await this.entries([result.session]);
    const frame =
      result.session.frame === null || result.session.frame_at === null
        ? null
        : {
            html: result.session.frame,
            capturedAtMs: new Date(result.session.frame_at).getTime(),
          };
    return { online: true, entry: entry!, frame };
  }
}
