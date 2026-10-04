// @io-wall-ok — browser device preference adapter, injected at composition.

import type { MotionPreferencePort } from '@pkgs/device-shared/motion-preference';
import { createMotionPreference } from '@pkgs/device-shared/motion-preference';

export function wallWebMotionPreference(): MotionPreferencePort {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  return {
    reduced: () => query.matches,
    subscribe: (listener) => {
      const changed = () => listener(query.matches);
      query.addEventListener('change', changed);
      return () => query.removeEventListener('change', changed);
    },
  };
}

/** Test builds change the injected preference instead of replacing matchMedia. */
export function controllableWebMotionPreference() {
  const source = wallWebMotionPreference();
  const preference = createMotionPreference(source.reduced());
  source.subscribe(preference.setReduced);
  return preference;
}
