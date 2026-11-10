import {
  LIVE_ONLINE_WINDOW_MS,
  LIVE_WATCH_LEASE_MS,
  type LiveFrame,
  type LiveHeartbeat,
  type OnlineNowFilter,
} from '@libs/synthetic-population-shared-ts/live-session';
import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import sql, { raw } from '@pkgs/sql-root-shared-ts/sql';
import type { SyntheticPopulationPorts } from './records';
import { isoAt } from './records';

/** One open app, as the server knows it. */
export type LiveDevice = {
  readonly accountId: string;
  readonly deviceId: string;
};

/** A row of `population_live_sessions` joined to its Synthetic User, if any. */
export type LiveSessionRow = {
  id: string;
  account_id: string;
  place: string;
  activity: string;
  game: string | null;
  heartbeat_at: string;
  synthetic_user_id: string | null;
};

const SESSION_COLUMNS = raw(
  's.id, s.account_id, s.place, s.activity, s.game, s.heartbeat_at, u.id AS synthetic_user_id'
);

/**
 * Who is online now: the heartbeats of every open app, a person's or a
 * Synthetic User's, and whether one is being watched live. Whether an app
 * belongs to a Synthetic User is decided here, from the Synthetic
 * Population's own directory; the app never says.
 */
export class LiveSessions {
  constructor(
    private readonly tx: SqlTx,
    private readonly ports: Pick<SyntheticPopulationPorts, 'clock' | 'createId'>
  ) {}

  private now(): string {
    return isoAt(this.ports.clock.now());
  }

  private cutoff(): string {
    return isoAt(this.ports.clock.now() - LIVE_ONLINE_WINDOW_MS);
  }

  /**
   * Records that the app is open and where; returns whether the list of
   * those online now changed (someone arrived, moved, or went quiet).
   */
  async heartbeat(device: LiveDevice, value: LiveHeartbeat): Promise<boolean> {
    const now = this.now();
    const before = await this.tx.query(sql<{
      place: string;
      activity: string;
      game: string | null;
      heartbeat_at: string;
      deleted_at: string | null;
    }>`SELECT place, activity, game, heartbeat_at, deleted_at FROM population_live_sessions
      WHERE account_id = ${device.accountId} AND device_id = ${device.deviceId}`);
    const previous = before[0];
    await this.tx.run(sql`
      INSERT INTO population_live_sessions (id, created_at, updated_at, account_id, device_id, place, activity, game, heartbeat_at)
      VALUES (${this.ports.createId()}, ${now}, ${now}, ${device.accountId}, ${device.deviceId}, ${value.place}, ${value.activity}, ${value.game}, ${now})
      ON CONFLICT (account_id, device_id) DO UPDATE SET place = excluded.place, activity = excluded.activity,
        game = excluded.game, heartbeat_at = excluded.heartbeat_at, updated_at = excluded.updated_at, deleted_at = NULL`);
    const arrived =
      previous === undefined ||
      previous.deleted_at !== null ||
      new Date(previous.heartbeat_at).toISOString() <= this.cutoff();
    const moved =
      previous !== undefined &&
      (previous.place !== value.place ||
        previous.activity !== value.activity ||
        previous.game !== value.game);
    const quiet = await this.endQuiet();
    return arrived || moved || quiet;
  }

  /** Apps whose heartbeat stopped are no longer online now. */
  private async endQuiet(): Promise<boolean> {
    const now = this.now();
    const ended = await this.tx.query(sql<{ id: string }>`
      UPDATE population_live_sessions SET deleted_at = ${now}, updated_at = ${now}, frame = NULL
      WHERE deleted_at IS NULL AND heartbeat_at <= ${this.cutoff()} RETURNING id`);
    return ended.length > 0;
  }

  /** The app was closed; returns whether it had been online now. */
  async end(device: LiveDevice): Promise<boolean> {
    const now = this.now();
    const ended = await this.tx.query(sql<{ id: string }>`
      UPDATE population_live_sessions SET deleted_at = ${now}, updated_at = ${now}, frame = NULL
      WHERE account_id = ${device.accountId} AND device_id = ${device.deviceId} AND deleted_at IS NULL RETURNING id`);
    await this.tx.run(sql`
      UPDATE population_live_watches SET deleted_at = ${now}, updated_at = ${now}
      WHERE account_id = ${device.accountId} AND device_id = ${device.deviceId} AND deleted_at IS NULL`);
    return ended.length > 0;
  }

  /** Whether this app is being watched live right now. */
  async watched(device: LiveDevice): Promise<boolean> {
    const rows = await this.tx.query(sql<{ id: string }>`
      SELECT id FROM population_live_watches
      WHERE account_id = ${device.accountId} AND device_id = ${device.deviceId}
        AND deleted_at IS NULL AND watched_until > ${this.now()}`);
    return rows.length > 0;
  }

  /** Keeps the watched app's latest screen; returns its session, if watched. */
  async frame(device: LiveDevice, value: LiveFrame): Promise<string | null> {
    if (!(await this.watched(device))) return null;
    const now = this.now();
    const rows = await this.tx.query(sql<{ id: string }>`
      UPDATE population_live_sessions SET frame = ${value.html}, frame_at = ${now}, updated_at = ${now}
      WHERE account_id = ${device.accountId} AND device_id = ${device.deviceId} AND deleted_at IS NULL
      RETURNING id`);
    return rows[0]?.id ?? null;
  }

  /** Everyone online now, people or Synthetic Users as `filter` chooses. */
  async onlineNow(filter: OnlineNowFilter): Promise<LiveSessionRow[]> {
    const kind =
      filter === 'people'
        ? raw('AND u.id IS NULL')
        : filter === 'synthetic'
          ? raw('AND u.id IS NOT NULL')
          : raw('');
    return this.tx.query(sql<LiveSessionRow>`
      SELECT ${SESSION_COLUMNS} FROM population_live_sessions s
      LEFT JOIN population_users u ON u.account_id = s.account_id AND u.deleted_at IS NULL
      WHERE s.deleted_at IS NULL AND s.heartbeat_at > ${this.cutoff()} ${kind}
      ORDER BY s.heartbeat_at DESC, s.id LIMIT 500`);
  }

  /** One session, while it is online now, with its latest screen. */
  async session(id: string): Promise<
    | (LiveSessionRow & {
        device_id: string;
        frame: string | null;
        frame_at: string | null;
      })
    | null
  > {
    const rows = await this.tx.query(sql<
      LiveSessionRow & {
        device_id: string;
        frame: string | null;
        frame_at: string | null;
      }
    >`
      SELECT ${SESSION_COLUMNS}, s.device_id, s.frame, s.frame_at FROM population_live_sessions s
      LEFT JOIN population_users u ON u.account_id = s.account_id AND u.deleted_at IS NULL
      WHERE s.id = ${id} AND s.deleted_at IS NULL AND s.heartbeat_at > ${this.cutoff()}`);
    return rows[0] ?? null;
  }

  /**
   * Asks the watched app for its screen for a while longer; returns whether
   * this starts a watch (the app was not already being watched).
   */
  async watch(device: LiveDevice): Promise<boolean> {
    const started = !(await this.watched(device));
    const now = this.now();
    const until = isoAt(this.ports.clock.now() + LIVE_WATCH_LEASE_MS);
    await this.tx.run(sql`
      INSERT INTO population_live_watches (id, created_at, updated_at, account_id, device_id, watched_until)
      VALUES (${this.ports.createId()}, ${now}, ${now}, ${device.accountId}, ${device.deviceId}, ${until})
      ON CONFLICT (account_id, device_id) DO UPDATE SET watched_until = excluded.watched_until,
        updated_at = excluded.updated_at, deleted_at = NULL`);
    return started;
  }
}
