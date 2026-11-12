/**
 * `specs/feedback/bug-report.qnt` against bug reporting as Alice and the
 * team meet it: her phone's bug report stays open, so the draft and the
 * count of kept bug reports are read off it, and the team's side is read off
 * the issues on its list of work.
 */

import type { FeedbackReportingWorld } from '@pkgs/feedback-harness-ts/feedback';
import {
  chooseToReport,
  closeBugReport,
  connection,
  describeBug,
  deviceSendsAgain,
  discardDraft,
  passDay,
  readDescription,
  readKeptBugReports,
  readTeamBugReportsSaying,
  readTeamBugReportsToday,
  reopenApp,
  sendBugReport,
  sendBugReports,
  teamReceivesAgain,
  teamStopsReceiving,
} from '@pkgs/feedback-harness-ts/feedback';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';
import type { QuintValue } from '@pkgs/quint-shared-ts/itf';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';

type World = Run<FeedbackReportingWorld>;

/** The model's `REPORTS`. */
const REPORTS = [1, 2, 3];

const saying = (report: number): string => `Bug report ${report}`;

/** Which of the model's bug reports a description is, as a set of at most one. */
function reportsOf(descriptions: readonly string[]): Set<QuintValue> {
  return new Set(
    REPORTS.filter((report) => descriptions.includes(saying(report)))
  );
}

bindQuintModel<World>({
  model: 'bug-report',
  traces: 24,
  maxSteps: 12,
  timeoutMs: 120_000,
  actions: {
    init: async (w, picks) => {
      await w.apply(sendBugReports, picks['taken'] as number);
      await w.apply(chooseToReport);
    },
    describeBug: (w, picks) =>
      w.apply(describeBug, saying(picks['report'] as number)),
    discardDraft: async (w) => {
      await w.apply(discardDraft);
      await w.apply(chooseToReport);
    },
    sendBugReport: async (w) => {
      await w.apply(sendBugReport);
      await w.apply(closeBugReport);
      await w.apply(chooseToReport);
    },
    reopenApp: async (w) => {
      await w.apply(reopenApp);
      await w.apply(chooseToReport);
    },
    dayPasses: (w) => w.apply(passDay),
    loseConnection: (w) => w.apply(connection, false),
    connectionReturns: (w) => w.apply(connection, true),
    _teamStopsReceiving: (w) => w.apply(teamStopsReceiving),
    _teamReceivesAgain: (w) => w.apply(teamReceivesAgain),
    _deviceSendsAgain: (w) => w.apply(deviceSendsAgain),
  },
  observe: async (w) => {
    const teamCopies = new Map<QuintValue, QuintValue>();
    for (const report of REPORTS)
      teamCopies.set(
        report,
        await w.read(readTeamBugReportsSaying, saying(report))
      );
    return {
      draft: reportsOf([await w.read(readDescription)]),
      kept: reportsOf(await w.read(readKeptBugReports)),
      teamCopies,
      takenToday: await w.read(readTeamBugReportsToday),
    };
  },
});
