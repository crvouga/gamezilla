/**
 * One device signed into the account, as the devices screens show it: its
 * synced `auth_devices` columns plus what this install alone can know about
 * its own session.
 */
export type AccountDeviceView = {
  readonly id: string;
  readonly createdAt: string | null;
  readonly platform: string | null;
  readonly osName: string | null;
  readonly osVersion: string | null;
  readonly deviceModelName: string | null;
  readonly deviceBrand: string | null;
  readonly deviceName: string | null;
  readonly appVersion: string | null;
  readonly appBuildNumber: string | null;
  readonly userAgent: string | null;
  readonly firstSeenAt: string | null;
  readonly lastSeenAt: string | null;
  /** This is the install the person is using. */
  readonly current: boolean;
  /**
   * Active sessions. Only the current install's local session is
   * observable, so this is 1 or 0.
   */
  readonly activeSessions: number;
  /** ISO expiry of the current install's session, else `null`. */
  readonly latestSessionExpiresAt: string | null;
};

/** The `auth_devices` columns the devices screens read. */
export type AccountDeviceRow = {
  readonly id: string;
  readonly created_at: unknown;
  readonly platform: unknown;
  readonly os_name: unknown;
  readonly os_version: unknown;
  readonly device_model_name: unknown;
  readonly device_brand: unknown;
  readonly device_name: unknown;
  readonly app_version: unknown;
  readonly app_build_number: unknown;
  readonly user_agent: unknown;
  readonly first_seen_at: unknown;
  readonly last_seen_at: unknown;
};

/** What this install knows about its own session. */
export type DeviceSessionFacts = {
  readonly currentDeviceId: string;
  readonly hasSession: boolean;
  readonly sessionExpiresAt: string | null;
};

function text(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/** `row` as the devices screens show it, given this install's session. */
export function accountDeviceViewOf(
  row: AccountDeviceRow,
  facts: DeviceSessionFacts
): AccountDeviceView {
  const current = row.id === facts.currentDeviceId;
  const session = current && facts.hasSession;
  return {
    id: row.id,
    createdAt: text(row.created_at),
    platform: text(row.platform),
    osName: text(row.os_name),
    osVersion: text(row.os_version),
    deviceModelName: text(row.device_model_name),
    deviceBrand: text(row.device_brand),
    deviceName: text(row.device_name),
    appVersion: text(row.app_version),
    appBuildNumber: text(row.app_build_number),
    userAgent: text(row.user_agent),
    firstSeenAt: text(row.first_seen_at),
    lastSeenAt: text(row.last_seen_at),
    current,
    activeSessions: session ? 1 : 0,
    latestSessionExpiresAt: session ? facts.sessionExpiresAt : null,
  };
}
