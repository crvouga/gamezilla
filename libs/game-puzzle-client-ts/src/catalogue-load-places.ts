import { defineScreenPlaces } from '@pkgs/turn-game-client-ts/screen-places';

/**
 * Loading a game's puzzle catalogue from a shared source file: the stage
 * the load stands in, the small screens each stage shows, and the named
 * state of everything those screens say. Pure: the container derives all
 * of it from the facts the game's hooks report.
 */

/** How the latest load stands, as the game's status row says it. */
export type CatalogueLoadJobStatus =
  | 'adding'
  | 'finished'
  | 'failed'
  | 'stopped';

/**
 * Where loading stands. Nobody navigates it: `denied` for a person who may
 * not load, `saving` while this device uploads the source file, `loading`
 * while puzzles are being added, then how the latest load ended; `ready`
 * when none has run.
 */
export type CatalogueLoadStage =
  | 'denied'
  | 'ready'
  | 'saving'
  | 'loading'
  | 'finished'
  | 'failed'
  | 'stopped';

/**
 * The small screen shown: `status` says why nothing can be done, `load` is
 * the hub (the pool, the source, the one command and the latest result) and
 * `source` is where the shared file is checked, chosen and saved.
 */
export type CatalogueLoadPlace =
  | { readonly screen: 'status' }
  | { readonly screen: 'load' }
  | { readonly screen: 'source' };

const STATUS: CatalogueLoadPlace = { screen: 'status' };
const LOAD: CatalogueLoadPlace = { screen: 'load' };
const SOURCE: CatalogueLoadPlace = { screen: 'source' };
const OPEN = ['load', 'source'] as const;

/**
 * Saving the file is a stage of its own whose only screen is `source`: Back
 * from it leaves the loader (and so asks before abandoning the upload)
 * instead of stepping to a hub that could do nothing meanwhile.
 */
export const CATALOGUE_LOAD_PLACES = defineScreenPlaces<
  CatalogueLoadStage,
  CatalogueLoadPlace
>({
  home: {
    denied: STATUS,
    ready: LOAD,
    saving: SOURCE,
    loading: LOAD,
    finished: LOAD,
    failed: LOAD,
    stopped: LOAD,
  },
  screens: {
    denied: ['status'],
    ready: OPEN,
    saving: ['source'],
    loading: OPEN,
    finished: OPEN,
    failed: OPEN,
    stopped: OPEN,
  },
  parent: (place) => (place.screen === 'source' ? LOAD : null),
});

/** The facts a stage is read from. */
export type CatalogueLoadStageFacts = {
  /** The person may load puzzles (`@libs/permissions` decided). */
  readonly allowed: boolean;
  /** This device is uploading the source file. */
  readonly uploading: boolean;
  /** The latest load's status; `null` when none has run or is known. */
  readonly job: CatalogueLoadJobStatus | null;
};

/** The stage the facts put loading in: access first, then this device's upload. */
export function catalogueLoadStage(
  facts: CatalogueLoadStageFacts
): CatalogueLoadStage {
  if (!facts.allowed) return 'denied';
  if (facts.uploading) return 'saving';
  if (facts.job === 'adding') return 'loading';
  return facts.job ?? 'ready';
}

/**
 * The device's line to the load's status: `offline`, `connecting` until the
 * status has its first answer, then `live`.
 */
export type CatalogueLoadLink = 'offline' | 'connecting' | 'live';

export function catalogueLoadLink(facts: {
  readonly online: boolean;
  readonly ready: boolean;
}): CatalogueLoadLink {
  if (!facts.online) return 'offline';
  return facts.ready ? 'live' : 'connecting';
}

/**
 * What is known of the shared source file: never checked (`unknown`, an
 * offline first opening), being checked, a check that failed, found
 * `missing`, a file `chosen` on this device and not yet saved, `uploading`,
 * or `saved`.
 */
export type CatalogueSourceStatus =
  | 'unknown'
  | 'checking'
  | 'check-failed'
  | 'missing'
  | 'chosen'
  | 'uploading'
  | 'saved';

/** The facts a source's status is read from. */
export type CatalogueSourceFacts = {
  /** The last check finished (found or not). */
  readonly known: boolean;
  /** A check is running. */
  readonly checking: boolean;
  /** The last check failed. */
  readonly failed: boolean;
  /** A saved file is known (it stays known through a later check). */
  readonly saved: boolean;
  /** A file is chosen on this device. */
  readonly chosen: boolean;
  /** This device is uploading the chosen file. */
  readonly uploading: boolean;
};

export function catalogueSourceStatus(
  facts: CatalogueSourceFacts
): CatalogueSourceStatus {
  if (facts.uploading) return 'uploading';
  if (facts.checking) return 'checking';
  if (facts.failed) return 'check-failed';
  if (!facts.known) return 'unknown';
  if (facts.saved) return 'saved';
  return facts.chosen ? 'chosen' : 'missing';
}

/** Why loading cannot start now; each has a line of its own on the hub. */
export type CatalogueStartBlock =
  | 'offline'
  | 'checking'
  | 'no-source'
  | 'connecting';

/** The hub's one command: start a load, or stop the one running. */
export type CatalogueLoadCommand =
  | { readonly kind: 'start'; readonly blocked: CatalogueStartBlock | null }
  | { readonly kind: 'stop'; readonly blocked: 'offline' | null };

/**
 * The hub's command and why it is unavailable. Starting needs a
 * connection, a finished check, a saved file and a live status; stopping
 * needs a connection.
 */
export function catalogueLoadCommand(facts: {
  readonly stage: CatalogueLoadStage;
  readonly link: CatalogueLoadLink;
  readonly source: CatalogueSourceStatus;
  /** A saved file is known, whatever the latest check says. */
  readonly saved: boolean;
}): CatalogueLoadCommand {
  const offline = facts.link === 'offline';
  if (facts.stage === 'loading')
    return { kind: 'stop', blocked: offline ? 'offline' : null };
  if (offline) return { kind: 'start', blocked: 'offline' };
  if (facts.source === 'checking') return { kind: 'start', blocked: 'checking' };
  if (!facts.saved) return { kind: 'start', blocked: 'no-source' };
  if (facts.link === 'connecting')
    return { kind: 'start', blocked: 'connecting' };
  return { kind: 'start', blocked: null };
}
