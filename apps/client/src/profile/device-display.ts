/**
 * Single source of truth for how a device's display name is shown in UI.
 */
export function displayNameForDevice(
  rawName: unknown,
  deviceId: string
): string {
  const t = typeof rawName === 'string' ? rawName.trim() : '';
  if (t.length > 0) return t;
  return `User ${deviceId.slice(0, 8)}`;
}
