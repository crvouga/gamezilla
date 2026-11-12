import { RETRY_MS } from '@pkgs/feedback-client-ts/controller';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import { defineRuntime } from '@pkgs/harness-root-shared-ts/define-runtime';
import { defineSystem } from '@pkgs/harness-root-shared-ts/define-system';
import type { Session } from '@pkgs/harness-root-shared-ts/runtime-types';
import { virtualTimeRuntime } from '@pkgs/harness-root-shared-ts/virtual-time-runtime';
import {
  type ApplicationCondition,
  createExampleApp,
  EXAMPLE_TROUBLE,
  EXAMPLE_VERSION,
  type ExampleApp,
} from './example-app';
import {
  createExamplePerson,
  type ExamplePerson,
  type ExamplePicture,
  screen,
} from './example-person';

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export type FeedbackReportingWorld = {
  readonly session: Session;
  readonly app: ExampleApp;
  readonly alice: ExamplePerson;
};
type World = FeedbackReportingWorld;

export const applicationCondition = defineAction({
  name: 'applicationCondition',
  act: (world: World, condition: ApplicationCondition) =>
    world.app.boot(condition),
});
export const reopenApp = defineAction({
  name: 'reopenApp',
  act: (world: World) => world.app.reopen(),
});
export const becomeGuest = defineAction({
  name: 'becomeGuest',
  act: (world: World) => world.app.setGuest(true),
});
export const chooseToReport = defineAction({
  name: 'chooseToReport',
  act: (world: World) => world.alice.chooseToReport(),
});
export const closeBugReport = defineAction({
  name: 'closeBugReport',
  act: (world: World) => world.alice.press('bug-report-close'),
});
export const describeBug = defineAction({
  name: 'describeBug',
  act: (world: World, description: string) => world.alice.describe(description),
});
export const sendBugReport = defineAction({
  name: 'sendBugReport',
  act: (world: World) => world.alice.send(),
});
/** Describes, sends and puts the bug report away, however the sending went. */
export const sendBugReportSaying = defineAction({
  name: 'sendBugReportSaying',
  act: (world: World, description: string) =>
    world.alice.sendSaying(description),
});
export const sendBugReports = defineAction({
  name: 'sendBugReports',
  act: (world: World, count: number) => world.alice.sendMany(count),
});
export const passDay = defineAction({
  name: 'passDay',
  act: (world: World) => world.alice.wait(DAY_MS),
});

export const shakePhone = defineAction({
  name: 'shakePhone',
  act: async (world: World) => {
    await world.app.phone.shake();
    await world.app.settle();
  },
});
export const turnOffShakeToReport = defineAction({
  name: 'turnOffShakeToReport',
  act: (world: World) => world.alice.setShake(false),
});
/** Turns shake to report on, and says yes when the phone asks. */
export const allowShakeToReport = defineAction({
  name: 'allowShakeToReport',
  act: (world: World) => {
    world.app.phone.setAllowsMotion(true);
    return world.alice.setShake(true);
  },
});
export const phoneAsksBeforeShaking = defineAction({
  name: 'phoneAsksBeforeShaking',
  act: (world: World) => {
    world.app.phone.setAsksBeforeMotion(true);
    return world.app.reopen();
  },
});
export const refuseShakeToReport = defineAction({
  name: 'refuseShakeToReport',
  act: (world: World) => {
    world.app.phone.setAllowsMotion(false);
    return world.alice.setShake(true);
  },
});

export const deviceTakesNoScreenshot = defineAction({
  name: 'deviceTakesNoScreenshot',
  act: (world: World) => world.app.phone.setTakesScreenshots(false),
});
export const removeScreenshot = defineAction({
  name: 'removeScreenshot',
  act: (world: World) => world.alice.press('bug-report-remove-screenshot'),
});
export const addPicture = defineAction({
  name: 'addPicture',
  act: (world: World, picture: ExamplePicture) =>
    world.alice.addPicture(picture),
});
export const haveScreenshots = defineAction({
  name: 'haveScreenshots',
  act: (world: World, count: number) => world.alice.haveScreenshots(count),
});

export const openSettings = defineAction({
  name: 'openSettings',
  act: (world: World) => world.alice.press('example-settings'),
});
export const waitMinutes = defineAction({
  name: 'waitMinutes',
  act: (world: World, minutes: number) => world.alice.wait(minutes * MINUTE_MS),
});
export const runIntoTrouble = defineAction({
  name: 'runIntoTrouble',
  act: (world: World) => world.app.runIntoTrouble(),
});
export const typeInApp = defineAction({
  name: 'typeInApp',
  act: (world: World, text: string) => world.alice.type(text),
});

export const connection = defineAction({
  name: 'connection',
  act: async (world: World, online: boolean) => {
    world.app.phone.setOnline(online);
    await world.app.settle();
  },
});
export const teamStopsReceiving = defineAction({
  name: 'teamStopsReceiving',
  act: (world: World) => world.app.team.setReceiving(false),
});
/** The team can receive again, and the device gets round to trying again. */
export const teamReceivesAgain = defineAction({
  name: 'teamReceivesAgain',
  act: (world: World) => {
    world.app.team.setReceiving(true);
    return world.alice.wait(RETRY_MS);
  },
});

export const readOpenBugReports = (_world: World) => screen.openBugReports();
export const readDescription = (_world: World) => screen.description();
export const readScreenshots = (_world: World) => screen.screenshots();
export const readNotice = (_world: World) => screen.notice();
export const readToldAboutDebugInfo = (_world: World) =>
  screen.toldAboutDebugInfo();
export const readToldToReportWithoutShaking = (_world: World) =>
  screen.toldToReportWithoutShaking();
export const readScreenshotShowsBugReport = (world: World) =>
  world.app.phone.lastScreenshotShowsBugReport();

export const readTeamBugReportCount = (world: World) =>
  world.app.team.received().length;

/** What the issue holds under a heading: the text inside the fence that follows it. */
function under(issue: string, heading: string): string {
  const from = issue.indexOf(heading);
  if (from < 0) return '';
  return /`{3,}\w*\n([\s\S]*?)\n`{3,}/.exec(issue.slice(from))?.[1] ?? '';
}

/** The newest bug report on the team's list of work, read off the issue itself. */
export const readTeamBugReport = (world: World) => {
  const newest = world.app.team.received().at(-1);
  if (!newest) return null;
  const { report, issue } = newest;
  const ledUpTo = under(issue, 'What led up to it');
  const details = JSON.parse(under(issue, 'Device and app') || '{}') as Record<
    string,
    Record<string, unknown> | undefined
  >;
  return {
    description: under(issue, '**What happened**'),
    screenshots: (issue.match(/!\[Screenshot \d+\]/g) ?? []).length,
    ledUpTo,
    showsTrouble: ledUpTo.includes(EXAMPLE_TROUBLE),
    namesDevice: details['device']?.['agent'] === window.navigator.userAgent,
    namesVersion: details['app']?.['version'] === EXAMPLE_VERSION,
    /** The issue and the full report it links to: all the team can ever read. */
    everything: `${issue}\n${JSON.stringify(report)}`,
  };
};

export const feedbackReportingSystem = defineSystem<World>({
  name: 'feedback',
  async create(session) {
    const app = createExampleApp(session);
    await app.boot();
    session.onDispose(() => app.close());
    return { session, app, alice: createExamplePerson(session, app) };
  },
  runtimes: [
    defineRuntime({
      name: 'virtual',
      default: true,
      create: () => virtualTimeRuntime(),
    }),
  ],
  actions: [
    applicationCondition,
    reopenApp,
    becomeGuest,
    chooseToReport,
    closeBugReport,
    describeBug,
    sendBugReport,
    sendBugReportSaying,
    sendBugReports,
    passDay,
    shakePhone,
    turnOffShakeToReport,
    allowShakeToReport,
    phoneAsksBeforeShaking,
    refuseShakeToReport,
    deviceTakesNoScreenshot,
    removeScreenshot,
    addPicture,
    haveScreenshots,
    openSettings,
    waitMinutes,
    runIntoTrouble,
    typeInApp,
    connection,
    teamStopsReceiving,
    teamReceivesAgain,
  ],
});
