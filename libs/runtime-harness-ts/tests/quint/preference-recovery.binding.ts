/**
 * `specs/runtime/preference-recovery.qnt` against the app a person uses.
 * Opening the theme choices, closing the app, choosing light, running into
 * trouble, and leaving for the profile are the same actions the scenarios run.
 * The theme, the place, and whether the choices are open are read back from
 * what the app shows.
 */

import { restartApp, spawnActor } from '@libs/harness-ts/actions';
import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import { backToTabs, focusActor } from '@libs/harness-ts/shell-actions';
import { chooseTheme } from '@libs/runtime-harness-ts/app-settings';
import {
  chooseLightTheme,
  leaveForProfile,
  openThemeChoices,
  preferencePlace,
  runIntoTrouble,
  themeChoicesOpen,
  themeShown,
} from '@libs/runtime-harness-ts/preference-recovery';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';

const PERSON = 'alice';

bindQuintModel<QuintHarnessWorld>({
  model: 'preference-recovery',
  traces: 12,
  maxSteps: 8,
  timeoutMs: 180_000,
  actions: {
    init: async (w) => {
      await w.s.apply(spawnActor, PERSON);
      await w.s.apply(chooseTheme, PERSON, 'dark');
      await w.s.apply(backToTabs, PERSON);
    },
    openThemeChoices: async (w) => {
      await w.s.apply(focusActor, PERSON);
      await w.s.apply(openThemeChoices, PERSON);
    },
    closeBeforeChoosing: async (w) => {
      await w.s.apply(restartApp, PERSON);
    },
    chooseLight: async (w) => {
      await w.s.apply(focusActor, PERSON);
      await w.s.apply(chooseLightTheme, PERSON);
    },
    runIntoTrouble: async (w) => {
      await w.s.apply(focusActor, PERSON);
      await w.s.apply(runIntoTrouble, PERSON);
    },
    leaveForProfile: async (w) => {
      await w.s.apply(focusActor, PERSON);
      await w.s.apply(leaveForProfile, PERSON);
    },
  },
  observe: async (w) => ({
    theme: await w.quiet.read(themeShown, PERSON),
    place: await w.quiet.read(preferencePlace, PERSON),
    choosing: await w.quiet.read(themeChoicesOpen, PERSON),
  }),
});
