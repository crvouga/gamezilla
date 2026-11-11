import { type Accessor, createMemo, createSignal } from 'solid-js';
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
  const [opened, setOpened] = createSignal<OpenedPlace<Stage, Place> | null>(
    null
  );
  const place = createMemo(() => placeIn(places, stage(), opened()));
  return {
    place,
    open: (next) => setOpened({ stage: stage(), place: next }),
    back: () => {
      const behind = placeBehind(places, stage(), place());
      if (behind === null) return false;
      setOpened({ stage: stage(), place: behind });
      return true;
    },
    home: () => setOpened(null),
  };
}
