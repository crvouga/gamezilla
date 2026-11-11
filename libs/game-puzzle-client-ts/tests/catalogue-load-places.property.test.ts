/**
 * The catalogue loader's machine, tested as a machine: whatever a device
 * opens and however loading moves, the place shown is one its stage shows,
 * Back reaches the stage's home, and the named states agree with the facts
 * they are read from.
 */
import { describe, expect, test } from 'bun:test';
import {
  CATALOGUE_LOAD_PLACES,
  type CatalogueLoadJobStatus,
  type CatalogueLoadLink,
  type CatalogueLoadPlace,
  type CatalogueLoadStage,
  type CatalogueSourceStatus,
  catalogueLoadCommand,
  catalogueLoadLink,
  catalogueLoadStage,
  catalogueSourceStatus,
} from '@libs/game-puzzle-client-ts/catalogue-load-places';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import {
  type OpenedPlace,
  placeBehind,
  placeIn,
  stageShows,
} from '@pkgs/turn-game-client-ts/screen-places';
import fc from 'fast-check';

const PLACES = CATALOGUE_LOAD_PLACES;
type Stage = CatalogueLoadStage;
type Place = CatalogueLoadPlace;
const STATUS: Place = { screen: 'status' };
const LOAD: Place = { screen: 'load' };
const SOURCE: Place = { screen: 'source' };

const stage = fc.constantFrom<Stage>(
  'denied',
  'ready',
  'saving',
  'loading',
  'finished',
  'failed',
  'stopped'
);
const place = fc.constantFrom<Place>(STATUS, LOAD, SOURCE);
const job = fc.constantFrom<CatalogueLoadJobStatus | null>(
  null,
  'adding',
  'finished',
  'failed',
  'stopped'
);
const link = fc.constantFrom<CatalogueLoadLink>(
  'offline',
  'connecting',
  'live'
);
const source = fc.constantFrom<CatalogueSourceStatus>(
  'unknown',
  'checking',
  'check-failed',
  'missing',
  'chosen',
  'uploading',
  'saved'
);

type Step =
  | { readonly kind: 'open'; readonly place: Place }
  | { readonly kind: 'back' }
  | { readonly kind: 'home' }
  | { readonly kind: 'stage'; readonly stage: Stage };

const step = fc.oneof(
  place.map((opened): Step => ({ kind: 'open', place: opened })),
  fc.constant<Step>({ kind: 'back' }),
  fc.constant<Step>({ kind: 'home' }),
  stage.map((next): Step => ({ kind: 'stage', stage: next }))
);

/** A device walking the machine as `useScreenPlace` does. */
function walk(steps: readonly Step[]): { stage: Stage; place: Place }[] {
  let at: Stage = 'ready';
  let opened: OpenedPlace<Stage, Place> | null = null;
  const seen: { stage: Stage; place: Place }[] = [];
  for (const next of steps) {
    if (next.kind === 'stage') at = next.stage;
    if (next.kind === 'open') opened = { stage: at, place: next.place };
    if (next.kind === 'home') opened = null;
    if (next.kind === 'back') {
      const behind: Place | null = placeBehind(
        PLACES,
        at,
        placeIn(PLACES, at, opened)
      );
      opened = behind === null ? null : { stage: at, place: behind };
    }
    seen.push({ stage: at, place: placeIn(PLACES, at, opened) });
  }
  return seen;
}

describe('the catalogue loader places', () => {
  test('whatever is opened, the place shown is one its stage shows', () => {
    assertProperty(
      'catalogue load: shown place belongs to its stage',
      fc.property(fc.array(step, { maxLength: 30 }), (steps) => {
        for (const seen of walk(steps))
          expect(stageShows(PLACES, seen.stage, seen.place)).toBe(true);
      })
    );
  });

  test('Back reaches the stage home, then leaves, in a bounded number of steps', () => {
    assertProperty(
      'catalogue load: back terminates at the home',
      fc.property(stage, place, (at, opened) => {
        let shown: Place | null = placeIn(PLACES, at, {
          stage: at,
          place: opened,
        });
        let steps = 0;
        while (shown !== null && steps <= PLACES.screens[at].length) {
          shown = placeBehind(PLACES, at, shown);
          steps += 1;
        }
        expect(shown).toBeNull();
      })
    );
  });

  test('a denied person sees only why, and saving shows only the source', () => {
    assertProperty(
      'catalogue load: denied and saving hold one screen',
      fc.property(place, (opened) => {
        expect(
          placeIn(PLACES, 'denied', { stage: 'denied', place: opened })
        ).toEqual(STATUS);
        expect(
          placeIn(PLACES, 'saving', { stage: 'saving', place: opened })
        ).toEqual(SOURCE);
        // From the one screen of either, Back leaves the loader.
        expect(placeBehind(PLACES, 'saving', SOURCE)).toBeNull();
        expect(placeBehind(PLACES, 'denied', STATUS)).toBeNull();
      })
    );
  });

  test('the source is a place behind the hub wherever the hub shows', () => {
    for (const at of [
      'ready',
      'loading',
      'finished',
      'failed',
      'stopped',
    ] as const) {
      expect(PLACES.home[at]).toEqual(LOAD);
      expect(placeBehind(PLACES, at, SOURCE)).toEqual(LOAD);
    }
  });
});

describe('the catalogue loader stage', () => {
  test('access comes first, then this device upload, then the latest load', () => {
    assertProperty(
      'catalogue load: stage of the facts',
      fc.property(fc.boolean(), fc.boolean(), job, (allowed, uploading, at) => {
        const named = catalogueLoadStage({ allowed, uploading, job: at });
        if (!allowed) expect(named).toBe('denied');
        else if (uploading) expect(named).toBe('saving');
        else if (at === 'adding') expect(named).toBe('loading');
        else expect(named).toBe(at ?? 'ready');
      })
    );
  });

  test('the line to the status is offline before it is connecting', () => {
    expect(catalogueLoadLink({ online: false, ready: true })).toBe('offline');
    expect(catalogueLoadLink({ online: false, ready: false })).toBe('offline');
    expect(catalogueLoadLink({ online: true, ready: false })).toBe(
      'connecting'
    );
    expect(catalogueLoadLink({ online: true, ready: true })).toBe('live');
  });
});

describe('the shared source file status', () => {
  const facts = fc.record({
    known: fc.boolean(),
    checking: fc.boolean(),
    failed: fc.boolean(),
    saved: fc.boolean(),
    chosen: fc.boolean(),
    uploading: fc.boolean(),
  });

  test('an unfinished or failed check never reads as a missing file', () => {
    assertProperty(
      'catalogue source: missing needs a finished check',
      fc.property(facts, (given) => {
        const status = catalogueSourceStatus(given);
        if (status === 'missing' || status === 'chosen') {
          expect(given.known).toBe(true);
          expect(given.checking || given.failed || given.saved).toBe(false);
        }
        if (status === 'saved') expect(given.saved && given.known).toBe(true);
        if (given.uploading) expect(status).toBe('uploading');
      })
    );
  });

  // The seven named statuses, each from the facts that give it.
  test.each([
    [{ uploading: true }, 'uploading'],
    [{ checking: true, saved: true }, 'checking'],
    [{ failed: true, saved: true }, 'check-failed'],
    [{}, 'unknown'],
    [{ known: true, saved: true }, 'saved'],
    [{ known: true, chosen: true }, 'chosen'],
    [{ known: true }, 'missing'],
  ] as const)('%j reads as %s', (given, status) => {
    expect(
      catalogueSourceStatus({
        known: false,
        checking: false,
        failed: false,
        saved: false,
        chosen: false,
        uploading: false,
        ...given,
      })
    ).toBe(status);
  });
});

describe("the hub's one command", () => {
  test('a load under way can only be stopped, and only with a connection', () => {
    assertProperty(
      'catalogue command: stop while loading',
      fc.property(link, source, fc.boolean(), (line, file, saved) => {
        expect(
          catalogueLoadCommand({
            stage: 'loading',
            link: line,
            source: file,
            saved,
          })
        ).toEqual({
          kind: 'stop',
          blocked: line === 'offline' ? 'offline' : null,
        });
      })
    );
  });

  test('starting needs a connection, a finished check, a saved file and a live status', () => {
    assertProperty(
      'catalogue command: start is free only when nothing blocks it',
      fc.property(
        fc.constantFrom<Stage>('ready', 'finished', 'failed', 'stopped'),
        link,
        source,
        fc.boolean(),
        (at, line, file, saved) => {
          const command = catalogueLoadCommand({
            stage: at,
            link: line,
            source: file,
            saved,
          });
          expect(command.kind).toBe('start');
          const free = line === 'live' && file !== 'checking' && saved;
          expect(command.blocked === null).toBe(free);
          if (line === 'offline') expect(command.blocked).toBe('offline');
        }
      )
    );
  });
});
