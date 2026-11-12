import { auditTree, formatFailure } from '@pkgs/a11y-shared-ts/audit';
import {
  controlsIn,
  describeControl,
  keyboardStops,
} from '@pkgs/a11y-shared-ts/controls';
import { nextInFocusOrder } from '@pkgs/a11y-shared-ts/focus';
import { isHiddenFromAt } from '@pkgs/a11y-shared-ts/visibility';
import {
  type BugReportNotice,
  DEBUG_INFO_NOTE,
  DESCRIPTION_FULL,
  noticeText,
  SHAKE_REFUSED,
  screenshotsText,
  waitingText,
} from '@pkgs/feedback-client-ts/copy';
import { MAX_SCREENSHOTS } from '@pkgs/feedback-shared-ts/bug-report';
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
/** More bug reports than any example keeps waiting. */
const MOST_WAITING = 100;
/** Everything said aloud as it changes. */
const SAID = '[role="status"], [role="alert"], [aria-live]';

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

/** The control the keyboard is on, or `null` when it is on none. */
function keyboardOn(): HTMLElement | null {
  const active = document.activeElement;
  return active instanceof HTMLElement && active !== document.body
    ? active
    : null;
}

/** What is said aloud to someone listening, wherever it is on the page. */
function said(): string[] {
  return [...document.querySelectorAll(SAID)]
    .filter((region) => !isHiddenFromAt(region))
    .map((region) => region.textContent.trim());
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
  /** Whether the shake to report setting shows as on. */
  shakeToReport: (): boolean =>
    inner('shake-setting-switch', '[role="switch"]').getAttribute(
      'aria-checked'
    ) === 'true',
  toldToReportWithoutShaking: (): boolean =>
    find('shake-setting-refused')?.textContent.trim() === SHAKE_REFUSED,
  /** How many bug reports the device says are waiting to be sent. */
  waiting(): number {
    const text = find('bug-report-waiting')?.textContent.trim();
    if (text === undefined) return 0;
    for (let count = 1; count <= MOST_WAITING; count++)
      if (text === waitingText(count)) return count;
    throw new Error(`The device says of its kept bug reports: ${text}`);
  },
  toldDescriptionIsFull: (): boolean =>
    find('bug-report-description-full')?.textContent.trim() ===
    DESCRIPTION_FULL,
  keyboardInBugReport: (): boolean =>
    find('bug-report')?.contains(keyboardOn()) === true,
  keyboardOnDescription: (): boolean => keyboardOn() === descriptionField(),
  /** Where the keyboard is, as a listener would hear it (`button "Report a bug"`). */
  keyboardPlace(): string | null {
    const control = keyboardOn();
    return control ? describeControl(control) : null;
  },
  /** Every stop the keyboard should make in the bug report, in the order shown. */
  keyboardStops: (): string[] =>
    keyboardStops(must('bug-report')).map(describeControl),
  /** Every control of the bug report as a listener hears it, and whatever is wrong with it. */
  heardControls() {
    const report = must('bug-report');
    return {
      controls: controlsIn(report).map(describeControl),
      problems: auditTree(report).map(formatFailure),
    };
  },
  heardNotice(): BugReportNotice | null {
    const heard = said();
    return NOTICES.find((notice) => heard.includes(noticeText(notice))) ?? null;
  },
  /** How many screenshots a listener is told the bug report has. */
  heardScreenshots(): number | null {
    const heard = said();
    for (let count = 0; count <= MAX_SCREENSHOTS; count++)
      if (heard.includes(screenshotsText(count))) return count;
    return null;
  },
};

/** Alice's hands: everything she does goes through what is on the screen. */
export function createExamplePerson(session: Session, app: ExampleApp) {
  /** Whether Alice uses the keyboard alone from now on. */
  let keyboardAlone = false;
  let keyboardBeforeOpening: string | null = null;
  let keyboardVisits: string[] = [];
  /** What Alice has sent, oldest first. */
  const sent: string[] = [];

  function key(type: string, name: string): KeyboardEvent {
    return new KeyboardEvent(type, {
      key: name,
      code: name,
      bubbles: true,
      cancelable: true,
    });
  }
  /** One press of Tab, as a browser handles it. */
  async function pressTab(): Promise<void> {
    const from = keyboardOn() ?? document.body;
    if (from.dispatchEvent(key('keydown', 'Tab'))) {
      const next = nextInFocusOrder(document.body, keyboardOn());
      if (next instanceof HTMLElement) next.focus();
      else keyboardOn()?.blur();
    }
    (keyboardOn() ?? document.body).dispatchEvent(key('keyup', 'Tab'));
    await app.settle();
  }
  /** Tabs to a control, going round the page at most once. */
  async function tabTo(control: HTMLElement): Promise<void> {
    const lap = document.querySelectorAll('*').length;
    for (let press = 0; keyboardOn() !== control; press++) {
      if (press > lap) throw new Error('The keyboard never reached it');
      await pressTab();
    }
  }
  /** Chooses a control: a click, or Tab to it and Enter. */
  async function choose(control: HTMLElement): Promise<void> {
    if (keyboardAlone) {
      await tabTo(control);
      app.phone.duringPress(() => {
        if (control.dispatchEvent(key('keydown', 'Enter'))) control.click();
      });
      control.dispatchEvent(key('keyup', 'Enter'));
    } else app.phone.duringPress(() => control.click());
    await app.settle();
  }
  /** Writes into a field as far as the field lets anyone write. */
  async function write(
    field: HTMLInputElement | HTMLTextAreaElement,
    text: string
  ): Promise<void> {
    const room = field.maxLength < 0 ? Infinity : field.maxLength;
    if (!keyboardAlone) {
      const fits = text.slice(0, Math.max(0, room - field.value.length));
      if (fits === '') return;
      field.value += fits;
      field.dispatchEvent(new InputEvent('input', { bubbles: true }));
      await app.settle();
      return;
    }
    await tabTo(field);
    for (const letter of text) {
      field.dispatchEvent(key('keydown', letter));
      if (field.value.length < room) {
        field.value += letter;
        field.dispatchEvent(
          new InputEvent('input', { data: letter, bubbles: true })
        );
      }
      field.dispatchEvent(key('keyup', letter));
      await app.settle();
    }
  }
  const press = (testid: string): Promise<void> =>
    choose(inner(testid, 'button, [role="switch"]'));
  async function chooseToReport(): Promise<void> {
    const offer = must('example-report-bug');
    if (keyboardAlone) await tabTo(offer);
    keyboardBeforeOpening = screen.keyboardPlace();
    await choose(offer);
  }
  async function open(): Promise<void> {
    if (screen.openBugReports() === 0) await chooseToReport();
  }
  async function describe(text: string): Promise<void> {
    await open();
    const field = descriptionField();
    if (field.value !== '') {
      field.value = '';
      field.dispatchEvent(new InputEvent('input', { bubbles: true }));
    }
    await write(field, text);
  }
  async function send(): Promise<void> {
    const description = screen.description();
    await sendAsShown();
    if (find('bug-report-done')) sent.push(description);
  }
  async function sendAsShown(): Promise<void> {
    if (keyboardAlone) await press('bug-report-send');
    else {
      must('bug-report-form').dispatchEvent(
        new Event('submit', { cancelable: true, bubbles: true })
      );
      await app.settle();
    }
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
    if ((toggle.getAttribute('aria-checked') === 'true') !== on)
      await choose(toggle);
    await app.settle();
  }
  return {
    press,
    chooseToReport,
    describe,
    send,
    sendSaying,
    /** The bug reports Alice sent that her device says are still waiting, oldest first. */
    kept: (): readonly string[] =>
      screen.waiting() === 0 ? [] : sent.slice(-screen.waiting()),
    useKeyboardAlone(): void {
      keyboardAlone = true;
    },
    keyboardBeforeOpening: (): string | null => keyboardBeforeOpening,
    keyboardVisits: (): readonly string[] => keyboardVisits,
    /** Tabs once round the bug report, telling the round from its first control. */
    async moveKeyboardThroughBugReport(): Promise<void> {
      const stops = screen.keyboardStops();
      const visits: string[] = [];
      for (let press = 0; press <= stops.length; press++) {
        await pressTab();
        const place = screen.keyboardInBugReport()
          ? screen.keyboardPlace()
          : null;
        if (place === null || place === visits[0]) break;
        visits.push(place);
      }
      const first = Math.max(0, visits.indexOf(stops[0] ?? ''));
      keyboardVisits = [...visits.slice(first), ...visits.slice(0, first)];
    },
    async addToDescription(text: string): Promise<void> {
      await open();
      await write(descriptionField(), text);
    },
    async discardDraft(): Promise<void> {
      await open();
      await press('bug-report-discard');
      await press('bug-report-discard-confirm');
    },
    /** Puts the bug report away, and comes back to it later. */
    async comeBackAfter(ms: number): Promise<void> {
      if (screen.openBugReports() > 0) await press('bug-report-close');
      await session.advanceTime(ms);
      await app.settle();
      await chooseToReport();
    },
    addPicture,
    type,
    setShake,
    /** Answers her phone about shaking, having the app ask it where the app offers to. */
    async answerPhoneAboutShaking(allowed: boolean): Promise<void> {
      app.phone.answerMotion(allowed);
      await app.settle();
      if (find('shake-setting-allow')) await press('shake-setting-allow');
    },
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
