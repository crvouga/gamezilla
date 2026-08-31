import { iosSimName } from './ios-sim-name';

/** Matches root package.json `"name"` — prefixes every provisioned simulator. */
export const SIM_PROJECT_SLUG = 'gamezilla';

const PROJECT_PREFIX = `${SIM_PROJECT_SLUG}-`;

export function isProjectSimName(name: string): boolean {
  return name.startsWith(PROJECT_PREFIX);
}

/** Project-owned simulator display name: `{slug}-{device}-{runtime}`. */
export function projectSimName(
  deviceTypeId: string,
  runtimeId: string
): string {
  return `${SIM_PROJECT_SLUG}-${iosSimName(deviceTypeId, runtimeId)}`;
}
