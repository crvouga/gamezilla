/**
 * The explicit state machine behind a template of small screens.
 *
 * A template stands in a **stage** nobody navigates (a game being set up,
 * played, over) and, within it, shows one **place**: a small screen this
 * device chose. Every stage has one home place and the few places reachable
 * from it; a place opened in one stage never survives into another.
 */

/** A small screen, named by `screen`; anything else it carries is its own. */
export type ScreenPlace = { readonly screen: string };

/** The places of one template: what each stage may show, and where Back leads. */
export type ScreenPlaces<Stage extends string, Place extends ScreenPlace> = {
  /** The place every stage opens on. */
  readonly home: Readonly<Record<Stage, Place>>;
  /** Every screen a stage may show, its home among them. */
  readonly screens: Readonly<Record<Stage, readonly Place['screen'][]>>;
  /**
   * The place Back leads to from `place`; `null` for the stage's home (from
   * a home, Back leaves the template).
   */
  readonly parent: (place: Place) => Place | null;
};

/** A place a device opened, with the stage it was opened in. */
export type OpenedPlace<Stage extends string, Place extends ScreenPlace> = {
  readonly stage: Stage;
  readonly place: Place;
};

function stagesOf<Stage extends string>(
  record: Readonly<Record<Stage, unknown>>
): readonly Stage[] {
  return Object.keys(record) as Stage[];
}

/**
 * Declare a template's places, checked once when the module loads: every
 * stage's home is one of its screens, and no stage lists a screen twice.
 */
export function defineScreenPlaces<
  Stage extends string,
  Place extends ScreenPlace,
>(places: ScreenPlaces<Stage, Place>): ScreenPlaces<Stage, Place> {
  for (const stage of stagesOf(places.home)) {
    const screens = places.screens[stage];
    const home = places.home[stage].screen;
    if (!screens.includes(home))
      throw new Error(`${stage}: its home "${home}" is not one of its screens`);
    if (new Set(screens).size !== screens.length)
      throw new Error(`${stage}: a screen is listed twice`);
  }
  return places;
}

/** Whether `stage` may show `place`. */
export function stageShows<Stage extends string, Place extends ScreenPlace>(
  places: ScreenPlaces<Stage, Place>,
  stage: Stage,
  place: Place
): boolean {
  return places.screens[stage].includes(place.screen);
}

/**
 * The place shown: the one this device opened, while the template is still
 * in the stage it was opened in and that stage shows it; the stage's home
 * otherwise.
 */
export function placeIn<Stage extends string, Place extends ScreenPlace>(
  places: ScreenPlaces<Stage, Place>,
  stage: Stage,
  opened: OpenedPlace<Stage, Place> | null
): Place {
  if (
    opened === null ||
    opened.stage !== stage ||
    !stageShows(places, stage, opened.place)
  )
    return places.home[stage];
  return opened.place;
}

/**
 * The place behind `place`: its parent when the stage shows it, the stage's
 * home when it does not, and `null` from the home itself, where Back leaves
 * the template.
 */
export function placeBehind<Stage extends string, Place extends ScreenPlace>(
  places: ScreenPlaces<Stage, Place>,
  stage: Stage,
  place: Place
): Place | null {
  const home = places.home[stage];
  if (place.screen === home.screen) return null;
  const parent = places.parent(place);
  return parent !== null && stageShows(places, stage, parent) ? parent : home;
}
