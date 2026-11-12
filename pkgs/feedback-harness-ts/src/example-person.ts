import {
  type BugReportNotice,
  DEBUG_INFO_NOTE,
  noticeText,
  SHAKE_REFUSED,
} from '@pkgs/feedback-client-ts/copy';
import type { Session } from '@pkgs/harness-root-shared-ts/runtime-types';
import type { ExampleApp } from './example-app';

const NOTICES: readonly BugReportNotice[] = [
  'describe',
  'sent',
  'offline',
  'later',
  'limit',
  'failed',
  'too-many',
  'not-a-picture',
  'too-large',
];
const MEGABYTE = 1024 * 1024;

/** Something Alice picks from her device to add to a bug report. */
export type ExamplePicture = {
  readonly contentType: string;
  /** Left out for the smallest picture there is. */
  readonly megabytes?: number;
};

function find(testid: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-testid="${testid}"]`);
}

function all(testid: string): HTMLElement[] {
  return [
    ...document.querySelectorAll<HTMLElement>(`[data-testid="${testid}"]`),
  ];
}

function must(testid: string): HTMLElement {
  const node = find(testid);
  if (!node) throw new Error(`Nothing on screen named ${testid}`);
  return node;
}

/** The control inside a labelled wrapper, or the wrapper when it is the control. */
function inner(testid: string, selector: string): HTMLElement {
  const node = must(testid);
  const control = node.matches(selector)
    ? node
    : node.querySelector<HTMLElement>(selector);
  if (!control) throw new Error(`${testid} holds no ${selector}`);
  return control;
}

function descriptionField(): HTMLTextAreaElement {
  return inner('bug-report-description', 'textarea') as HTMLTextAreaElement;
}

/** What Alice sees of bug reporting, read off the screen. */
export const screen = {
  openBugReports: (): number =>
    all('bug-report-form').length + all('bug-report-done').length,
  description: (): string => descriptionField().value,
  screenshots: (): number => all('bug-report-screenshot').length,
  notice(): BugReportNotice | null {
    const text = find('bug-report-notice')?.textContent.trim();
    return NOTICES.find((notice) => noticeText(notice) === text) ?? null;
  },
  toldAboutDebugInfo: (): boolean =>
    find('bug-report-debug-info')?.textContent.trim() === DEBUG_INFO_NOTE,
  toldToReportWithoutShaking: (): boolean =>
    find('shake-setting-refused')?.textContent.trim() === SHAKE_REFUSED,
};

/** Alice's hands: everything she does goes through what is on the screen. */
export function createExamplePerson(session: Session, app: ExampleApp) {
  async function press(testid: string): Promise<void> {
    must(testid).click();
    await app.settle();
  }
  async function chooseToReport(): Promise<void> {
    await press('example-report-bug');
  }
  async function describe(text: string): Promise<void> {
    if (screen.openBugReports() === 0) await chooseToReport();
    const field = descriptionField();
    field.value = text;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await app.settle();
  }
  async function send(): Promise<void> {
    must('bug-report-form').dispatchEvent(
      new Event('submit', { cancelable: true, bubbles: true })
    );
    await app.settle();
  }
  async function sendSaying(text: string): Promise<void> {
    await describe(text);
    await send();
    await press('bug-report-done-close');
  }
  async function addPicture(picture: ExamplePicture): Promise<void> {
    const input = must('bug-report-picture') as HTMLInputElement;
    const bytes = new Uint8Array(
      Math.max(app.phone.picture.length, (picture.megabytes ?? 0) * MEGABYTE)
    );
    bytes.set(app.phone.picture);
    const file = new File([bytes], 'chosen', { type: picture.contentType });
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file],
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await app.settle();
  }
  async function type(text: string): Promise<void> {
    const note = must('example-note') as HTMLInputElement;
    note.click();
    for (const key of text) {
      note.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      note.value += key;
      note.dispatchEvent(new InputEvent('input', { data: key, bubbles: true }));
      note.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
    }
    note.dispatchEvent(new Event('change', { bubbles: true }));
    await app.settle();
  }
  /** Leaves the shake to report switch on or off, pressing it only if it is not. */
  async function setShake(on: boolean): Promise<void> {
    const toggle = inner('shake-setting-switch', '[role="switch"]');
    if ((toggle.getAttribute('aria-checked') === 'true') !== on) toggle.click();
    await app.settle();
  }
  return {
    press,
    chooseToReport,
    describe,
    send,
    sendSaying,
    addPicture,
    type,
    setShake,
    async sendMany(count: number): Promise<void> {
      for (let sent = 1; sent <= count; sent++)
        await sendSaying(`Bug number ${sent}`);
    },
    async haveScreenshots(count: number): Promise<void> {
      if (screen.openBugReports() === 0) await chooseToReport();
      while (screen.screenshots() < count)
        await addPicture({ contentType: 'image/png' });
    },
    async wait(ms: number): Promise<void> {
      await session.advanceTime(ms);
      await app.settle();
    },
  };
}

export type ExamplePerson = ReturnType<typeof createExamplePerson>;
