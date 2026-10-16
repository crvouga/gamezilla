import { sep } from 'node:path';
import { allSpecs, hostSkips } from './health';

/** Every journey this isolated environment can honestly run. */
export function releaseJourneySpecs(): readonly string[] {
  const marker = `${sep}specs${sep}journeys${sep}`;
  return allSpecs().filter((path) => {
    if (!path.includes(marker) || !path.endsWith('.feature')) return false;
    const uri = `specs/journeys/${path.split(marker)[1]}`;
    return !hostSkips({ production: false, observability: false }, uri)
      .wholeFeature;
  });
}
