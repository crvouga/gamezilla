import { Handles } from '@libs/test-ids-shared-ts/handles';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';

export type ContentJourneyDevice = { ui: Driver; timeoutMs: number };
export type PublishedJourneyContent = {
  documentId: string;
  revisionId: string;
  title: string;
};
export type ContentJourneyBoard = {
  edit(device: ContentJourneyDevice): Promise<void>;
  preview(device: ContentJourneyDevice): Promise<void>;
  solve(device: ContentJourneyDevice): Promise<void>;
};

type Place = {
  /** The stage's root: every one of its small screens carries it. */
  readonly root: string;
  /** The hub's handle: visible while the stage is on its home. */
  readonly home: string;
  /** The hub row (or the stage's one control onward) that opens the place. */
  readonly row: string;
  /** A handle only the place itself has. */
  readonly mark: string;
};

const LIBRARY = {
  root: 'content-library',
  home: 'content-library-tab-continue',
};
const BUILDER = { root: 'content-author', home: 'content-author-steps' };
const ATTEMPT = { root: 'content-attempt', home: 'content-open-progress' };

/** The small screens of the puzzle library template a journey can ask for. */
const PLACES = {
  continue: {
    ...LIBRARY,
    row: 'content-library-tab-continue',
    mark: 'content-library-continue',
  },
  solved: {
    ...LIBRARY,
    row: 'content-library-tab-solved',
    mark: 'content-library-solved',
  },
  browse: {
    ...LIBRARY,
    row: 'content-library-tab-browse',
    mark: 'content-library-browse',
  },
  mine: {
    ...LIBRARY,
    row: 'content-library-tab-mine',
    mark: 'content-library-mine',
  },
  playtests: {
    ...LIBRARY,
    row: 'content-library-tab-playtests',
    mark: 'content-library-playtests',
  },
  details: {
    ...BUILDER,
    row: 'content-author-details-toggle',
    mark: 'content-author-details',
  },
  board: {
    ...BUILDER,
    row: 'content-open-board',
    mark: 'content-author-stage',
  },
  preview: {
    ...BUILDER,
    row: 'content-preview',
    mark: 'content-author-preview',
  },
  publish: {
    ...BUILDER,
    row: 'content-open-publish',
    mark: 'content-author-publish',
  },
  copies: {
    ...BUILDER,
    row: 'content-open-copies',
    mark: 'content-author-copies',
  },
  progress: {
    ...ATTEMPT,
    row: 'content-open-progress',
    mark: 'content-attempt-progress',
  },
} as const satisfies Record<string, Place>;

export type ContentJourneyPlace = keyof typeof PLACES;

/**
 * The small screen that holds a control, by the control's handle; `null`
 * for a control every screen of its stage has (the save line, a confirm
 * dialog), one a hub holds, or one that is no content control at all (a
 * game's own board).
 */
const HELD: readonly (readonly [RegExp, ContentJourneyPlace])[] = [
  [/^content-(published-|more-published$)/, 'browse'],
  [/^content-draft-(?!save-status$)/, 'mine'],
  [/^content-(title|description|difficulty|details-done)$/, 'details'],
  [
    /^content-(add-puzzle-|pack-item-|create-in-pack$|open-pack-puzzle$|pack-order$|pack-menu$|pack-up$|pack-down$|pack-remove$|undo-draft-edit$|redo-draft-edit$)/,
    'board',
  ],
  [/^content-preview-puzzle-/, 'preview'],
  [
    /^content-(validate|publish|validation-passed|validation-step|publication-status|publication-steps|publication-pending|start-playtest|open-playtest|withdraw|proof)$/,
    'publish',
  ],
  [/^content-use-copy-(?!confirm$|dismiss$)/, 'copies'],
  [
    /^content-(attempt-complete|attempt-solved-before|next-puzzle|return-pack|return-builder)$/,
    'progress',
  ],
  [/^content-position-(?!save-status$|confirm$|dismiss$)/, 'progress'],
  [/^content-attempt-(?!rules-changed$)/, 'continue'],
];

export function contentPlaceOf(id: string): ContentJourneyPlace | null {
  return HELD.find(([shape]) => shape.test(id))?.[1] ?? null;
}

type Stage = { readonly root: string; readonly home: string };

/** The hub (the attempt's board) that holds a control, by the control's handle. */
const HUB_HELD: readonly (readonly [RegExp, Stage])[] = [
  [
    /^content-(library-tab-|bundled-|create-puzzle$|create-pack$|open-created-draft$)/,
    LIBRARY,
  ],
  [
    /^content-(author-details-toggle|author-next|open-board|preview|open-publish|open-copies)$/,
    BUILDER,
  ],
  [/^content-(undo|redo|restart|open-restart|open-progress)$/, ATTEMPT],
];

/** Back until `stage`'s hub shows; nothing happens when it already does. */
async function showHub(
  device: ContentJourneyDevice,
  stage: Stage
): Promise<void> {
  const ui = device.ui;
  // A previewed pack puzzle is two steps from the hub.
  for (let steps = 0; steps < 3; steps += 1) {
    if (await ui.get(stage.home).isVisible()) return;
    await ui.get(Handles.navBack).tap(device);
    await ui.get(stage.root).expect.visible(device);
  }
  await ui.get(stage.home).expect.visible(device);
}

/**
 * Open one of the template's small screens the way a person does: from the
 * hub, by its row; from another small screen of the same stage, Back to the
 * hub first. Waits for the stage itself (a builder, an attempt, the
 * library) to be there.
 */
export async function openContentPlace(
  device: ContentJourneyDevice,
  place: ContentJourneyPlace
): Promise<void> {
  const { root, home, row, mark } = PLACES[place];
  const ui = device.ui;
  await ui.get(root).expect.visible(device);
  if (await ui.get(mark).isVisible()) return;
  await showHub(device, { root, home });
  await ui.get(row).wait('enabled', device);
  await ui.get(row).tap(device);
  await ui.get(mark).expect.visible(device);
}

/**
 * Return to the hub of whichever stage is open (the attempt's board), by
 * Back: a journey that read or acted on another small screen leaves the
 * device where a person would continue from. Nothing happens on a home, or
 * on a screen that is none of the template's.
 */
export async function showContentHome(
  device: ContentJourneyDevice
): Promise<void> {
  for (const stage of [BUILDER, ATTEMPT, LIBRARY]) {
    if (!(await device.ui.get(stage.root).isVisible())) continue;
    await showHub(device, stage);
    return;
  }
}

/**
 * Leave what is open as a person does from its hub: first back to the hub
 * (the attempt's board) when a small screen is shown, then one Back, which
 * leads to the library (from an edition opened from its pack, to the pack).
 */
export async function leaveContentStage(
  device: ContentJourneyDevice
): Promise<void> {
  await showContentHome(device);
  await device.ui.get(Handles.navBack).wait('enabled', device);
  await device.ui.get(Handles.navBack).tap(device);
}

/**
 * A control of a hub (a row, the attempt's own commands): back to that hub
 * when one of its stage's small screens is shown instead.
 */
async function showHubControl(
  device: ContentJourneyDevice,
  id: string
): Promise<void> {
  const stage = HUB_HELD.find(([shape]) => shape.test(id))?.[1];
  if (stage === undefined) return;
  await device.ui
    .get(id)
    .wait('visible', { ...device, visibleOr: [stage.root] })
    .catch(() => undefined);
  if (await device.ui.get(id).isVisible()) return;
  if (await device.ui.get(stage.root).isVisible()) await showHub(device, stage);
}

/**
 * Brings the control `id` into view: opens the small screen that holds it
 * (`place`, else the one its handle says). A library row waits for the
 * library to be there or the row to be on screen already; a control no
 * place is known for is left where it is.
 */
export async function showContentControl(
  device: ContentJourneyDevice,
  id: string,
  place: ContentJourneyPlace | null = contentPlaceOf(id)
): Promise<void> {
  if (place === null) {
    await showHubControl(device, id);
    return;
  }
  const { root } = PLACES[place];
  await device.ui
    .get(id)
    .wait('visible', { ...device, visibleOr: [root] })
    .catch(() => undefined);
  if (await device.ui.get(id).isVisible()) return;
  if (!(await device.ui.get(root).isVisible())) return;
  await openContentPlace(device, place);
}

/** Taps `id`, first opening the small screen that holds it (`place`, else the one its handle says). */
export async function contentTap(
  device: ContentJourneyDevice,
  id: string,
  place?: ContentJourneyPlace
): Promise<void> {
  await showContentControl(device, id, place);
  await device.ui.get(id).wait('enabled', device);
  await device.ui.get(id).tap(device);
}

export async function contentAttribute(
  device: ContentJourneyDevice,
  id: string,
  attribute: string
): Promise<string> {
  await showContentControl(device, id);
  await device.ui.get(id).expect.visible(device);
  const value = await device.ui.get(id).attribute(attribute);
  if (value === null || value === '')
    throw new Error(`${id} does not identify its ${attribute}`);
  return value;
}

export async function contentInput(
  device: ContentJourneyDevice,
  id: string,
  value: string
): Promise<void> {
  await showContentControl(device, id);
  await device.ui.get(id).clear();
  await device.ui.get(id).input(value, device);
}

/** Waits until `id`, on the small screen that holds it, says `text`. */
export async function contentExpectText(
  device: ContentJourneyDevice,
  id: string,
  text: string,
  exact = false
): Promise<void> {
  await showContentControl(device, id);
  await device.ui.get(id).expect.text(text, { ...device, exact });
}

/** The builder's details form (title, description, difficulty), opened from its hub. */
export async function openContentDetails(
  device: ContentJourneyDevice
): Promise<void> {
  await openContentPlace(device, 'details');
  await device.ui.get('content-title').expect.visible(device);
}
