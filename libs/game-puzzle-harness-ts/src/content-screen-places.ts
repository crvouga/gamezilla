import { Handles } from '@libs/test-ids-shared-ts/handles';
import { fireEvent } from '@solidjs/testing-library';

/** What a mounted content screen offers a driver: lookups by handle. */
export type ContentScreen = {
  queryByTestId(id: string): HTMLElement | null;
  getByTestId(id: string): HTMLElement;
};

/** Waits until `ready` holds, as the harness that mounted the screen waits. */
export type ContentScreenWait = (ready: () => boolean) => Promise<void>;

type Place = {
  /** The hub's handle: its presence says the stage is on its home. */
  readonly home: string;
  /** The hub row (or the stage's one control onward) that opens the place. */
  readonly row: string;
  /** A handle only the place itself has. */
  readonly mark: string;
};

const LIBRARY_HOME = 'content-library-tab-continue';
const BUILDER_HOME = 'content-author-steps';
const ATTEMPT_HOME = 'content-open-progress';

/** The small screens of the puzzle library template a driver can ask for. */
const PLACES = {
  continue: {
    home: LIBRARY_HOME,
    row: 'content-library-tab-continue',
    mark: 'content-library-continue',
  },
  solved: {
    home: LIBRARY_HOME,
    row: 'content-library-tab-solved',
    mark: 'content-library-solved',
  },
  browse: {
    home: LIBRARY_HOME,
    row: 'content-library-tab-browse',
    mark: 'content-library-browse',
  },
  mine: {
    home: LIBRARY_HOME,
    row: 'content-library-tab-mine',
    mark: 'content-library-mine',
  },
  playtests: {
    home: LIBRARY_HOME,
    row: 'content-library-tab-playtests',
    mark: 'content-library-playtests',
  },
  details: {
    home: BUILDER_HOME,
    row: 'content-author-details-toggle',
    mark: 'content-author-details',
  },
  board: {
    home: BUILDER_HOME,
    row: 'content-open-board',
    mark: 'content-author-stage',
  },
  preview: {
    home: BUILDER_HOME,
    row: 'content-preview',
    mark: 'content-author-preview',
  },
  publish: {
    home: BUILDER_HOME,
    row: 'content-open-publish',
    mark: 'content-author-publish',
  },
  copies: {
    home: BUILDER_HOME,
    row: 'content-open-copies',
    mark: 'content-author-copies',
  },
  progress: {
    home: ATTEMPT_HOME,
    row: 'content-open-progress',
    mark: 'content-attempt-progress',
  },
} as const satisfies Record<string, Place>;

export type ContentScreenPlace = keyof typeof PLACES;

/** A stage of the template, by the hub it opens on. */
export type ContentScreenStage = 'library' | 'builder' | 'attempt';

const HOMES: Record<ContentScreenStage, string> = {
  library: LIBRARY_HOME,
  builder: BUILDER_HOME,
  attempt: ATTEMPT_HOME,
};

const shows = (view: ContentScreen, id: string): boolean =>
  view.queryByTestId(id) !== null;

function enabled(view: ContentScreen, id: string): boolean {
  const control = view.queryByTestId(id);
  return (
    control !== null && !control.matches(':disabled, [aria-disabled="true"]')
  );
}

/** Press the host's Back, as a person does to return from a small screen. */
export function pressContentBack(view: ContentScreen): void {
  fireEvent.click(view.getByTestId(Handles.navBack));
}

/**
 * Return to the hub of what is open (the attempt's board), by Back, as a
 * person does: a driver that read or acted on another small screen leaves
 * the device where it found it.
 */
export async function showContentHome(
  wait: ContentScreenWait,
  view: ContentScreen,
  stage: ContentScreenStage
): Promise<void> {
  const home = HOMES[stage];
  // A previewed pack puzzle is two steps from the hub.
  for (let steps = 0; steps < 3 && !shows(view, home); steps += 1)
    pressContentBack(view);
  await wait(() => shows(view, home));
}

/**
 * Open one of the template's small screens the way a person does: from the
 * hub, by its row; from another small screen of the same stage, Back to the
 * hub first. Waits for the stage itself (a builder, an attempt, the
 * library) to be there.
 */
export async function openContentPlace(
  wait: ContentScreenWait,
  view: ContentScreen,
  place: ContentScreenPlace
): Promise<void> {
  const { home, row, mark } = PLACES[place];
  const stage = Object.values(PLACES)
    .filter((entry) => entry.home === home)
    .map((entry) => entry.mark);
  // The stage is open once its hub or any of its small screens shows.
  await wait(
    () => shows(view, home) || stage.some((other) => shows(view, other))
  );
  if (shows(view, mark)) return;
  for (let steps = 0; steps < 3 && !shows(view, home); steps += 1)
    pressContentBack(view);
  await wait(() => enabled(view, row));
  fireEvent.click(view.getByTestId(row));
  await wait(() => shows(view, mark));
}

/** Whether the hub offers a way into `place` (`null`: it shows no such row). */
export function contentPlaceOffered(
  view: ContentScreen,
  place: ContentScreenPlace
): boolean | null {
  return shows(view, PLACES[place].row)
    ? enabled(view, PLACES[place].row)
    : null;
}

/** The library lists that may hold a saved attempt, most likely first. */
const ATTEMPT_LISTS = ['continue', 'playtests', 'solved'] as const;

/** The library lists that may hold a row, by the row's handle. */
function listsOf(entry: string): readonly ContentScreenPlace[] {
  if (entry.startsWith('content-published-')) return ['browse'];
  if (entry.startsWith('content-draft-')) return ['mine'];
  if (entry.startsWith('content-attempt-')) return ATTEMPT_LISTS;
  return [];
}

/** Look for `entry` on one library list; back on the hub when it is not there. */
function findOnList(
  view: ContentScreen,
  entry: string,
  list: ContentScreenPlace
): boolean {
  const { row, mark } = PLACES[list];
  if (!shows(view, mark)) {
    if (!enabled(view, row)) return false;
    fireEvent.click(view.getByTestId(row));
  }
  if (shows(view, entry)) return true;
  pressContentBack(view);
  return false;
}

/**
 * Bring a library row into view: open the list that holds it (a saved
 * attempt may be under Continue, Playtests or Solved) and wait until the
 * row has arrived there. A row of the hub itself (a starter pack, a create
 * row) only waits.
 */
export async function showLibraryEntry(
  wait: ContentScreenWait,
  view: ContentScreen,
  entry: string
): Promise<void> {
  const lists = listsOf(entry);
  await wait(() => {
    if (shows(view, entry)) return true;
    if (!shows(view, LIBRARY_HOME)) return false;
    return lists.some((list) => findOnList(view, entry, list));
  });
}

/** Open a library row: bring it into view, then press it. */
export async function openLibraryEntry(
  wait: ContentScreenWait,
  view: ContentScreen,
  entry: string
): Promise<void> {
  await showLibraryEntry(wait, view, entry);
  fireEvent.click(view.getByTestId(entry));
}
