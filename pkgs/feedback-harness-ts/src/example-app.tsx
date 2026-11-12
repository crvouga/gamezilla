/** @jsxImportSource solid-js */
import { browserDetails } from '@pkgs/feedback-client-ts/browser-details';
import { mountBugReports } from '@pkgs/feedback-client-ts/mount-bug-reports';
import {
  bugReportsOf,
  requestBugReport,
} from '@pkgs/feedback-client-ts/request-bug-report';
import { ShakeSetting } from '@pkgs/feedback-client-ts/shake-setting';
import { registerFeedbackContext } from '@pkgs/feedback-shared-ts/context';
import type { DiagnosticProvider } from '@pkgs/feedback-shared-ts/types';
import type { Session } from '@pkgs/harness-root-shared-ts/runtime-types';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { render } from 'solid-js/web';
import { createExamplePhone } from './example-phone';
import { createExampleTeam, EXAMPLE_ORIGIN } from './example-team';

export type ApplicationCondition =
  | 'working'
  | 'loading'
  | 'crashed'
  | 'cannot-sign-in';

export const EXAMPLE_VERSION = 'example-1.4.0';
export const EXAMPLE_TROUBLE = 'The hint could not be shown';
/** The account Alice is signed in to, and the id her app has with or without one. */
export const EXAMPLE_ACCOUNT = 'account-alice';
const EXAMPLE_LOCAL_ID = 'local-alice';
const TROUBLE_EVENT = 'example-trouble';
const FAILURES: Partial<Record<ApplicationCondition, string>> = {
  crashed: 'The app crashed while starting',
  'cannot-sign-in': 'Signing in failed',
};

function control(tag: string, testid: string, text: string): HTMLElement {
  const node = document.createElement(tag);
  node.dataset['testid'] = testid;
  node.textContent = text;
  return node;
}

/** The app's own offer to report a bug. */
function reportOffer(): HTMLElement {
  const button = control('button', 'example-report-bug', 'Report a bug');
  button.addEventListener('click', () => requestBugReport(document));
  return button;
}

function workingScreen(): HTMLElement[] {
  const note = document.createElement('input');
  note.dataset['testid'] = 'example-note';
  note.setAttribute('aria-label', 'Note');
  const settings = document.createElement('section');
  const bugReports = bugReportsOf(document);
  if (bugReports)
    render(
      () => (
        <ThemeProvider colorScheme="light" manageDocumentTheme={false}>
          <ShakeSetting shake={bugReports.shake} />
        </ThemeProvider>
      ),
      settings
    );
  return [
    control('button', 'example-settings', 'Settings'),
    note,
    settings,
    reportOffer(),
  ];
}

/**
 * A small app with bug reporting mounted beside it the way a real app
 * mounts it: first, and apart, so the app failing is itself reportable.
 */
export function createExampleApp(session: Session) {
  const { clock, timers, createId } = session.ports;
  let device = new ObjectStoreImplInMemory();
  const team = createExampleTeam(clock);
  const phone = createExamplePhone(session);
  let condition: ApplicationCondition = 'working';
  let guest = false;
  let mounted: ReturnType<typeof mountBugReports> | null = null;
  let nodes: HTMLElement[] = [];
  // Who is using the app reaches a bug report the way a real app says it:
  // every visit has an id of its own, and only a signed-in person an account.
  const forgetVisit = registerFeedbackContext({
    name: 'session',
    collect: () => ({ sessionId: 'example-visit', userId: EXAMPLE_LOCAL_ID }),
  });
  const forgetAccount = registerFeedbackContext({
    name: 'account',
    collect: () => (guest ? {} : { id: EXAMPLE_ACCOUNT }),
  });
  const providers = (): DiagnosticProvider[] => [
    ...browserDetails(window, EXAMPLE_VERSION),
    {
      name: 'connection',
      collect: () => ({ online: phone.connection.online() }),
    },
  ];
  function close(): void {
    mounted?.dispose();
    mounted = null;
    for (const node of nodes) node.remove();
    nodes = [];
  }
  function startApplication(main: HTMLElement): void {
    const failure = FAILURES[condition];
    if (condition === 'working') main.append(...workingScreen());
    else if (failure === undefined)
      main.append(control('p', 'example-loading', 'Loading…'));
    else {
      document.dispatchEvent(
        new CustomEvent(TROUBLE_EVENT, { detail: new Error(failure) })
      );
      main.append(control('p', 'example-failure', failure), reportOffer());
    }
  }
  async function boot(next: ApplicationCondition = condition): Promise<void> {
    close();
    condition = next;
    const host = document.createElement('aside');
    const main = document.createElement('main');
    document.body.append(host, main);
    nodes = [host, main];
    mounted = mountBugReports({
      window,
      document,
      host,
      endpoint: `${EXAMPLE_ORIGIN}/api/bug-reports`,
      http: team.http,
      store: device,
      clock,
      timers,
      createId,
      screenshot: phone.screenshot,
      connection: phone.connection,
      motion: phone.motion(),
      theme: { read: () => 'light', subscribe: () => () => undefined },
      providers: providers(),
      applicationErrorEvent: TROUBLE_EVENT,
    });
    startApplication(main);
    await settle();
  }
  async function settle(): Promise<void> {
    await mounted?.ready;
    await session.waitForIdle();
    await mounted?.controller.settled();
    await session.waitForIdle();
  }
  return {
    team,
    phone,
    boot,
    settle,
    close(): void {
      close();
      forgetVisit();
      forgetAccount();
    },
    reopen: () => boot(),
    /** Alice picks up another device of hers: nothing of the first one is on it. */
    useAnotherDevice(): Promise<void> {
      device = new ObjectStoreImplInMemory();
      return boot();
    },
    setGuest(next: boolean): void {
      guest = next;
    },
    runIntoTrouble(): void {
      document.dispatchEvent(
        new CustomEvent(TROUBLE_EVENT, { detail: new Error(EXAMPLE_TROUBLE) })
      );
    },
  };
}

export type ExampleApp = ReturnType<typeof createExampleApp>;
