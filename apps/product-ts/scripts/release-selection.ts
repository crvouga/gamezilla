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

/**
 * One process running every release feature took 515 to 600+ s on a runner
 * against a 600 s budget, so a slow feature killed the whole task and held a
 * pull request's verdict until it finished. The journeys are split into
 * `test:release-journeys:<k>` tasks (`RELEASE_JOURNEY_PARTS` in
 * `turbo-ci-run.ts`), each booting the same isolated stack and running its
 * share of the features.
 */

/** `--part=<k>/<n>`: the share of the release specs one task runs. */
export function parseReleasePart(
  argv: readonly string[]
): { readonly part: number; readonly parts: number } | null {
  for (const arg of argv) {
    const match = /^--part=(\d+)\/(\d+)$/.exec(arg);
    if (match === null) continue;
    const part = Number(match[1]);
    const parts = Number(match[2]);
    if (parts < 1 || part >= parts)
      throw new Error(`${arg} is not a part of a split into ${parts}`);
    return { part, parts };
  }
  return null;
}

/**
 * Every spec in exactly one of `parts` shares, the heaviest first into the
 * lightest share (ties to the lowest index), so the shares are the same on
 * every machine and one slow feature never shares a task with another.
 */
export function splitReleaseSpecs(
  specs: readonly string[],
  parts: number,
  weigh: (spec: string) => number
): string[][] {
  const shares = Array.from({ length: parts }, () => ({
    weight: 0,
    specs: [] as string[],
  }));
  const ordered = [...specs]
    .map((spec) => ({ spec, weight: Math.max(1, weigh(spec)) }))
    .sort(
      (a, b) =>
        b.weight - a.weight || (a.spec < b.spec ? -1 : a.spec > b.spec ? 1 : 0)
    );
  for (const { spec, weight } of ordered) {
    const lightest = shares.reduce((best, share) =>
      share.weight < best.weight ? share : best
    );
    lightest.specs.push(spec);
    lightest.weight += weight;
  }
  return shares.map((share) => share.specs.sort());
}
