/**
 * Pure formatters / parsers for device-attribute scalars. Atoms call these
 * with `useQueryAttribute` outputs — no `AccountDevice` bundle involved.
 */

export const EM_DASH = '\u2014';

/** Trim a stored string attribute, returning `null` for absent / blank. */
export function parseTrimmedStringAttr(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

export function formatTimestamp(value: string | null): string {
  if (value === null) return EM_DASH;
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return value;
  return new Date(ms).toLocaleString();
}

export function formatOsLine(
  osName: string | null,
  osVersion: string | null
): string {
  if (osName !== null && osVersion !== null) {
    return `${osName} ${osVersion}`;
  }
  if (osName !== null) return osName;
  if (osVersion !== null) return osVersion;
  return EM_DASH;
}

export function formatModelLine(
  deviceBrand: string | null,
  deviceModelName: string | null
): string {
  const parts = [deviceBrand, deviceModelName].filter(
    (x): x is string => x !== null && x.length > 0
  );
  if (parts.length === 0) return EM_DASH;
  return parts.join(' ');
}

export function formatAppLine(
  appVersion: string | null,
  appBuildNumber: string | null
): string {
  if (appVersion !== null && appBuildNumber !== null) {
    return `${appVersion} (build ${appBuildNumber})`;
  }
  if (appVersion !== null) return appVersion;
  if (appBuildNumber !== null) return `Build ${appBuildNumber}`;
  return EM_DASH;
}

/** Primary label for a device row (no profile display name). */
export function formatDeviceListTitle(args: {
  deviceId: string;
  deviceName: string | null;
  deviceBrand: string | null;
  deviceModelName: string | null;
}): string {
  const { deviceId, deviceName, deviceBrand, deviceModelName } = args;
  if (deviceName !== null && deviceName.trim().length > 0) {
    return deviceName.trim();
  }
  const model = formatModelLine(deviceBrand, deviceModelName);
  if (model !== EM_DASH) return model;
  return `Device ${deviceId.slice(0, 8)}\u2026`;
}

/** Secondary line for device list rows (OS + last seen). */
export function formatDeviceListCaption(args: {
  osName: string | null;
  osVersion: string | null;
  lastSeenAt: string | null;
  createdAt: string | null;
}): string {
  const { osName, osVersion, lastSeenAt, createdAt } = args;
  const os = formatOsLine(osName, osVersion);
  const last = formatTimestamp(lastSeenAt ?? createdAt);
  return `${os} · Last seen ${last}`;
}
