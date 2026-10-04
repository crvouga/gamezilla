import type { OriginAvailability } from '@pkgs/http-client-shared/origin-availability';
import { createAlwaysAvailableOrigin } from '@pkgs/http-client-shared/origin-availability';
import type { ClientEnv } from './client-env';

const availabilityByEnv = new WeakMap<ClientEnv, OriginAvailability>();

export function setOriginAvailability(
  env: ClientEnv,
  availability: OriginAvailability
): void {
  availabilityByEnv.set(env, availability);
}

export function originAvailabilityFor(env: ClientEnv): OriginAvailability {
  return availabilityByEnv.get(env) ?? createAlwaysAvailableOrigin();
}
