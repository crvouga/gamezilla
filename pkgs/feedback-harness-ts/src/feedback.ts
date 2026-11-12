import { MAX_RETRY_MS } from '@pkgs/feedback-client-ts/controller';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import { defineRuntime } from '@pkgs/harness-root-shared-ts/define-runtime';
import { defineSystem } from '@pkgs/harness-root-shared-ts/define-system';
import type { Session } from '@pkgs/harness-root-shared-ts/runtime-types';
import { virtualTimeRuntime } from '@pkgs/harness-root-shared-ts/virtual-time-runtime';
import {
  type ApplicationCondition,
  createExampleApp,
  EXAMPLE_ACCOUNT,
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
export const signIn = defineAction({
  name: 'signIn',
  act: (world: World) => world.app.setGuest(false),
});
export const useAnotherDevice = defineAction({
  name: 'useAnotherDevice',
  act: (world: World) => world.app.useAnotherDevice(),
});
export const useKeyboardAlone = defineAction({
  name: 'useKeyboardAlone',
  act: (world: World) => world.alice.useKeyboardAlone(),
});
/** Alice only listens; what she hears is read off what the app says aloud. */
export const listenToApp = defineAction({
  name: 'listenToApp',
  act: (world: World) => world.app.settle(),
});
export const moveKeyboardThroughBugReport = defineAction({
  name: 'moveKeyboardThroughBugReport',
  act: (world: World) => world.alice.moveKeyboardThroughBugReport(),
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
/** A description of exactly this many characters. */
export const describeBugAtLength = defineAction({
  name: 'describeBugAtLength',
  act: (world: World, characters: number) =>
    world.alice.describe(
      'The board froze. '.repeat(characters).slice(0, characters)
    ),
});
export const addToDescription = defineAction({
  name: 'addToDescription',
  act: (world: World) => world.alice.addToDescription(' And once more.'),
});
export const discardDraft = defineAction({
  name: 'discardDraft',
  act: (world: World) => world.alice.discardDraft(),
});
export const comeBackToDraft = defineAction({
  name: 'comeBackToDraft',
  act: (world: World, minutes: number) =>
    world.alice.comeBackAfter(minutes * MINUTE_MS),
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
export const turnOnShakeToReport = defineAction({
  name: 'turnOnShakeToReport',
  act: (world: World) => world.alice.setShake(true),
});
/** Alice tells her phone the app may notice shaking. */
export const allowShakeToReport = defineAction({
  name: 'allowShakeToReport',
  act: (world: World) => world.alice.answerPhoneAboutShaking(true),
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
  act: (world: World) => world.alice.answerPhoneAboutShaking(false),
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
    return world.alice.wait(MAX_RETRY_MS);
  },
});
/** The device sends once more what it last sent, as after an answer that got lost. */
export const deviceSendsAgain = defineAction({
  name: 'deviceSendsAgain',
  act: async (world: World) => {
    // An offline device sends nothing, again or otherwise.
    if (!world.app.phone.connection.online()) return;
    await world.app.team.receiveAgain();
    await world.app.settle();
  },
});

export const readOpenBugReports = (_world: World) => screen.openBugReports();
export const readDescription = (_world: World) => screen.description();
export const readScreenshots = (_world: World) => screen.screenshots();
export const readNotice = (_world: World) => screen.notice();
export const readToldAboutDebugInfo = (_world: World) =>
  screen.toldAboutDebugInfo();
export const readShakeToReport = (_world: World) => screen.shakeToReport();
/** What Alice's phone says about the app noticing shaking. */
export const readPhoneAllows = (world: World) => world.app.phone.allowsMotion();
/** The draft Alice's device holds, or `null` when it holds none. */
export const readDraft = async (world: World) => {
  const draft = await world.app.draft();
  const kept = {
    described: draft.description !== '',
    screenshots: draft.screenshots.length,
  };
  return kept.described || kept.screenshots > 0 ? kept : null;
};
export const readToldToReportWithoutShaking = (_world: World) =>
  screen.toldToReportWithoutShaking();
export const readScreenshotShowsBugReport = (world: World) =>
  world.app.phone.lastScreenshotShowsBugReport();

export const readKeptBugReports = (world: World) => world.alice.kept();
export const readDescriptionFull = (_world: World) =>
  screen.toldDescriptionIsFull();
export const readKeyboardInBugReport = (_world: World) =>
  screen.keyboardInBugReport();
export const readKeyboardOnDescription = (_world: World) =>
  screen.keyboardOnDescription();
export const readKeyboardPlace = (_world: World) => screen.keyboardPlace();
export const readKeyboardBeforeOpening = (world: World) =>
  world.alice.keyboardBeforeOpening();
export const readKeyboardVisits = (world: World) =>
  world.alice.keyboardVisits();
export const readKeyboardStops = (_world: World) => screen.keyboardStops();
export const readHeardControls = (_world: World) => screen.heardControls();
export const readHeardNotice = (_world: World) => screen.heardNotice();
export const readHeardScreenshots = (_world: World) =>
  screen.heardScreenshots();

/** What the issue holds under a heading: the text inside the fence that follows it. */
function under(issue: string, heading: string): string {
  const from = issue.indexOf(heading);
  if (from < 0) return '';
  return /`{3,}\w*\n([\s\S]*?)\n`{3,}/.exec(issue.slice(from))?.[1] ?? '';
}

const describedIn = (issue: string): string =>
  under(issue, '**What happened**');

export const readTeamBugReportCount = async (world: World) =>
  (await world.app.team.received()).length;

/** How many bug reports on the team's list of work say exactly this. */
export const readTeamBugReportsSaying = async (
  world: World,
  description: string
) =>
  (await world.app.team.received()).filter(
    (received) => describedIn(received.issue) === description
  ).length;

/** How many bug reports landed on the team's list of work today, as the team counts days. */
export const readTeamBugReportsToday = async (world: World) => {
  const today = new Date(world.session.ports.clock.now())
    .toISOString()
    .slice(0, 10);
  return (await world.app.team.received()).filter((received) =>
    received.receivedAt.startsWith(today)
  ).length;
};

/** Who the issue says sent it: an account by name, or a guest. */
function sentBy(issue: string) {
  const said = /\*\*Sent by\*\* (.*)/.exec(issue)?.[1] ?? '';
  return {
    guest: said === 'a guest',
    account: /^account `(.*)`$/.exec(said)?.[1] ?? null,
  };
}

/** The newest bug report on the team's list of work, read off the issue itself. */
export const readTeamBugReport = async (world: World) => {
  const newest = (await world.app.team.received()).at(-1);
  if (!newest) return null;
  const { report, issue } = newest;
  const ledUpTo = under(issue, 'What led up to it');
  const details = JSON.parse(under(issue, 'Device and app') || '{}') as Record<
    string,
    Record<string, unknown> | undefined
  >;
  const sender = sentBy(issue);
  return {
    description: describedIn(issue),
    screenshots: (issue.match(/!\[Screenshot \d+\]/g) ?? []).length,
    ledUpTo,
    showsTrouble: ledUpTo.includes(EXAMPLE_TROUBLE),
    namesDevice: details['device']?.['agent'] === window.navigator.userAgent,
    namesVersion: details['app']?.['version'] === EXAMPLE_VERSION,
    fromGuest: sender.guest,
    namesAccount: sender.account === EXAMPLE_ACCOUNT,
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
    signIn,
    useAnotherDevice,
    useKeyboardAlone,
    listenToApp,
    moveKeyboardThroughBugReport,
    chooseToReport,
    closeBugReport,
    describeBug,
    describeBugAtLength,
    addToDescription,
    discardDraft,
    comeBackToDraft,
    sendBugReport,
    sendBugReportSaying,
    sendBugReports,
    passDay,
    shakePhone,
    turnOffShakeToReport,
    turnOnShakeToReport,
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
    deviceSendsAgain,
  ],
});
