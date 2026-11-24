import { type Accessor, createMemo, createSignal, untrack } from 'solid-js';
import {
  type OpenedPlace,
  placeBehind,
  placeIn,
  type ScreenPlace,
  type ScreenPlaces,
} from './screen-places';

/** The place a device shows within a template, and how it moves. */
export type ScreenPlaceNavigation<Place extends ScreenPlace> = {
  /** The small screen shown now. */
  readonly place: Accessor<Place>;
  /** Show another of the stage's places. */
  readonly open: (place: Place) => void;
  /**
   * One step back: `true` when it led to another place, `false` from the
   * stage's home, where Back leaves the template.
   */
  readonly back: () => boolean;
  /** Return to the stage's home. */
  readonly home: () => void;
};

/**
 * A template's place on this device: the stage comes from the data, the
 * place from what the person opened. When the stage changes the device is
 * on the new stage's home.
 */
export function useScreenPlace<Stage extends string, Place extends ScreenPlace>(
  places: ScreenPlaces<Stage, Place>,
  stage: Accessor<Stage>
): ScreenPlaceNavigation<Place> {
  // The stage as a value: the data behind it changes far more often than
  // the stage it yields (a seat taken, a move played), and only a change
  // of stage may move the person.
  const current = createMemo(stage);
  // A place does not outlive its stage: once the stage changes it is
  // forgotten, so returning to that stage later opens on its home again
  // (a game menu left open when a game ends is not there for the rematch).
  const [opened, setOpened] = createSignal<OpenedPlace<Stage, Place> | null>(
    () => {
      current();
      return null;
    }
  );
  const place = createMemo(() => placeIn(places, current(), opened()));
  // A move is made from where the device stands when it is asked for, by a
  // press or by an effect reacting to the data: the stage and the place are
  // read once, as of that moment.
  const standing = () => untrack(() => ({ stage: current(), place: place() }));
  return {
    place,
    open: (next) => setOpened({ stage: standing().stage, place: next }),
    back: () => {
      const { stage: from, place: shown } = standing();
      const behind = placeBehind(places, from, shown);
      if (behind === null) return false;
      setOpened({ stage: from, place: behind });
      return true;
    },
    home: () => setOpened(null),
  };
}
