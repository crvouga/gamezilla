import { sep } from 'node:path';
import { allSpecs, type Environment, hostSkips } from './health';

/** The localhost stack: no deployment, and no request records kept. */
export const RELEASE_ENVIRONMENT: Environment = {
  production: false,
  observability: false,
  deployment: false,
};

/**
 * Every health spec this isolated environment can honestly run: the journeys
 * and each other health check that needs nothing a deployed environment
 * alone has. A health spec left out is left out by a `HOST_LIMITS` entry
 * that says why, so none can reach the deploy unchecked without being named.
 */
export function releaseSpecs(): readonly string[] {
  return allSpecs().filter((path) => {
    if (!path.endsWith('.feature')) return false;
    const uri = path
      .slice(path.indexOf(`${sep}specs${sep}`) + 1)
      .split(sep)
      .join('/');
    return !hostSkips(RELEASE_ENVIRONMENT, uri).wholeFeature;
  });
}
