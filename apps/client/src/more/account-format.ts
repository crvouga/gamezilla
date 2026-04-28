import type { AccountPrincipal } from '@gamezilla/client/auth/use-account-principals';

export const EM_DASH = '\u2014';

export function formatTimestamp(value: string | null): string {
  if (value === null) return EM_DASH;
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return value;
  return new Date(ms).toLocaleString();
}

export function formatOsLine(p: AccountPrincipal): string {
  if (p.osName !== null && p.osVersion !== null) {
    return `${p.osName} ${p.osVersion}`;
  }
  if (p.osName !== null) return p.osName;
  if (p.osVersion !== null) return p.osVersion;
  return EM_DASH;
}

export function formatModelLine(p: AccountPrincipal): string {
  const parts = [p.deviceBrand, p.deviceModelName].filter(
    (x): x is string => x !== null && x.length > 0
  );
  if (parts.length === 0) return EM_DASH;
  return parts.join(' ');
}

export function formatAppLine(p: AccountPrincipal): string {
  const v = p.appVersion;
  const b = p.appBuildNumber;
  if (v !== null && b !== null) return `${v} (build ${b})`;
  if (v !== null) return v;
  if (b !== null) return `Build ${b}`;
  return EM_DASH;
}

/** Primary label for a device row (no profile display name). */
export function formatDeviceListTitle(p: AccountPrincipal): string {
  if (p.deviceName !== null && p.deviceName.trim().length > 0) {
    return p.deviceName.trim();
  }
  const model = formatModelLine(p);
  if (model !== EM_DASH) return model;
  return `Device ${p.entityId.slice(0, 8)}\u2026`;
}

/** Secondary line for device list rows (OS + last seen). */
export function formatDeviceListCaption(p: AccountPrincipal): string {
  const os = formatOsLine(p);
  const last = formatTimestamp(p.lastSeenAt ?? p.createdAt);
  return `${os} · Last seen ${last}`;
}
