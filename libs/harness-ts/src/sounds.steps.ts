/**
 * The app's sounds, turned on or off in Settings: shared by every context
 * whose features say what a person hears.
 */

import { Given } from './define';
import type { Actor } from './parameter-types';
import { configureSounds } from './sounds-preference';

Given('{actor} has turned sounds on', (w, actor: Actor) =>
  w.s.apply(configureSounds, actor, true)
);
Given('{actor} has turned sounds off', (w, actor: Actor) =>
  w.s.apply(configureSounds, actor, false)
);
