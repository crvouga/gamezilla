import { ProfileReadRepository } from '@libs/profile-shared-ts/read-profile';
import type {
  LiveActivity,
  LiveFrame,
  LiveHeartbeat,
  LiveHeartbeatAnswer,
  LiveKind,
  LivePlace,
  OnlineNowFilter,
} from '@libs/synthetic-population-shared-ts/live-session';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import {
  type LiveDevice,
  type LiveSessionRow,
  LiveSessions,
} from './live-sessions';
import type { SyntheticPopulationPorts } from './records';
import { SyntheticPopulationRepository } from './synthetic-population-repository';

/** One app online now, as the Bot Observatory lists it. */
export type OnlineNowEntry = {
  readonly sessionId: string;
  readonly kind: LiveKind;
  /** The Synthetic User's own id, for its control panel; `null` for a person. */
  readonly syntheticUserId: string | null;
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

/** Ports the live observatory needs beyond the database. */
export type LiveObservatoryPorts = Pick<
  SyntheticPopulationPorts,
  'clock' | 'createId'
> & {
  /** Tells watchers and the observatory that someone moved or left. */
  readonly presenceChanged: () => Promise<void>;
  /** Tells a watcher that a new picture of the screen is waiting. */
  readonly frameChanged: (sessionId: string) => Promise<void>;
  /** Tells the watched account's apps, through their own sync, to look. */
  readonly wakeAccount: (accountId: string) => Promise<void>;
};

async function entries(
  db: SqlClient,
  rows: readonly LiveSessionRow[]
): Promise<OnlineNowEntry[]> {
  const cards = await new ProfileReadRepository(db).readCardsByIds([
    ...new Set(rows.map((row) => row.account_id)),
  ]);
  const byId = new Map(cards.map((card) => [card.userId, card]));
  return rows.map((row) => ({
    sessionId: row.id,
    kind: row.synthetic_user_id === null ? 'person' : 'synthetic',
    syntheticUserId: row.synthetic_user_id,
    username: byId.get(row.account_id)?.username ?? '',
    avatarConfig: byId.get(row.account_id)?.avatarConfig ?? null,
    accountId: row.account_id,
    place: row.place as LivePlace,
    activity: row.activity as LiveActivity,
    game: row.game,
    heartbeatAtMs: new Date(row.heartbeat_at).getTime(),
  }));
}

/**
 * Who is online now and what each one's screen shows: the use case behind
 * the app's live-session reporter and the Bot Observatory's live view.
 */
export class LiveObservatory {
  constructor(
    private readonly db: SqlClient,
    private readonly ports: LiveObservatoryPorts
  ) {}

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

  async onlineNow(filter: OnlineNowFilter): Promise<OnlineNowEntry[]> {
    return entries(
      this.db,
      await new LiveSessions(this.db, this.ports).onlineNow(filter)
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
      const device = {
        accountId: session.account_id,
        deviceId: session.device_id,
      };
      const started = await sessions.watch(device);
      if (started)
        await new SyntheticPopulationRepository(tx, {
          ...this.ports,
          notify: async () => undefined,
        }).event({
          name: 'LiveWatchStarted',
          context: {
            actorId: watcherId,
            sessionId,
            watchedAccountId: session.account_id,
          },
        });
      return { session, started };
    });
    if (result === null) return { online: false };
    if (result.started) await this.ports.wakeAccount(result.session.account_id);
    const [entry] = await entries(this.db, [result.session]);
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
