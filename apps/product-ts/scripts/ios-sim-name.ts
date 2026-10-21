const SIM_DEVICE_TYPE_PREFIX = 'com.apple.CoreSimulator.SimDeviceType.';
const SIM_RUNTIME_PREFIX = 'com.apple.CoreSimulator.SimRuntime.';

/** Lowercase kebab segment from a simctl identifier or human name. */
export function kebabSimSegment(raw: string, prefix: string): string {
  const rest = raw.startsWith(prefix) ? raw.slice(prefix.length) : raw;
  return rest
    .trim()
    .replaceAll(/[._\s()]+/g, '-')
    .replaceAll(/-+/g, '-')
    .replaceAll(/^-|-$/g, '')
    .toLowerCase();
}

/**
 * Simulator display name: kebab-case device type + runtime, no product slug.
 * Example: `iphone-17-pro-ios-26-0`.
 */
export function iosSimName(deviceTypeId: string, runtimeId: string): string {
  const type = kebabSimSegment(deviceTypeId, SIM_DEVICE_TYPE_PREFIX);
  const runtime = kebabSimSegment(runtimeId, SIM_RUNTIME_PREFIX);
  return `${type}-${runtime}`;
}
