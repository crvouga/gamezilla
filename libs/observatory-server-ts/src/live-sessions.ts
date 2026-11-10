import {
  LIVE_ONLINE_WINDOW_MS,
  LIVE_WATCH_LEASE_MS,
  type LiveFrame,
  type LiveHeartbeat,
} from '@libs/observatory-shared-ts/live-session';
import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import sql, { raw } from '@pkgs/sql-root-shared-ts/sql';
import { isoAt, type ObservatoryPorts } from './ports';

/** One open app, as the server knows it. */
export type LiveDevice = {
  readonly accountId: string;
  readonly deviceId: string;
};

/** A row of `population_live_sessions`: one open app. */
export type LiveSessionRow = {
  id: string;
  account_id: string;
  place: string;
  activity: string;
  game: string | null;
  heartbeat_at: string;
};

const SESSION_COLUMNS = raw(
  'id, account_id, place, activity, game, heartbeat_at'
);

/**
 * Who is online now: the heartbeats of every open app, a person's or a
 * Synthetic User's, and whether one is being watched live.
 */
export class LiveSessions {
  constructor(
    private readonly tx: SqlTx,
    private readonly ports: Pick<ObservatoryPorts, 'clock' | 'createId'>
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

  /** Everyone online now, most recently heard from first. */
  async onlineNow(): Promise<LiveSessionRow[]> {
    return this.tx.query(sql<LiveSessionRow>`
      SELECT ${SESSION_COLUMNS} FROM population_live_sessions
      WHERE deleted_at IS NULL AND heartbeat_at > ${this.cutoff()}
      ORDER BY heartbeat_at DESC, id LIMIT 500`);
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
      SELECT ${SESSION_COLUMNS}, device_id, frame, frame_at FROM population_live_sessions
      WHERE id = ${id} AND deleted_at IS NULL AND heartbeat_at > ${this.cutoff()}`);
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
