import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import {
  dayBegins,
  dayEnds,
  deviceConnection,
  givenDailyRhythm,
  observeDailyRhythm,
  playsGame,
} from '@libs/synthetic-population-harness-ts/daily-rhythm-model';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';

bindQuintModel<QuintHarnessWorld>({
  model: 'daily-rhythm',
  traces: 64,
  maxSteps: 12,
  verifySteps: 4,
  actions: {
    init: (w, picks) => w.s.apply(givenDailyRhythm, Number(picks['desired'])),
    scheduleBegins: (w, picks) => w.s.apply(dayBegins, String(picks['who'])),
    scheduleEnds: (w, picks) => w.s.apply(dayEnds, String(picks['who'])),
    startNextActivity: (w, picks) =>
      w.s.apply(playsGame, String(picks['who']), true),
    _finishGame: (w, picks) =>
      w.s.apply(playsGame, String(picks['who']), false),
    _loseConnection: (w, picks) =>
      w.s.apply(deviceConnection, String(picks['who']), false),
    _comeBackOnline: (w, picks) =>
      w.s.apply(deviceConnection, String(picks['who']), true),
  },
  observe: (w) => w.quiet.read(observeDailyRhythm),
});
