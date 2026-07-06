import type { Observability } from './observability';

export function isObservabilityActive(obs: Observability): boolean {
  return obs.backend !== 'noop';
}
