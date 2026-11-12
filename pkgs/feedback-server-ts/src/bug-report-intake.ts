import type { Clock } from '@pkgs/clock-shared-ts/types';
import {
  DAILY_BUG_REPORT_LIMIT,
  MAX_SCREENSHOT_BYTES,
  MAX_SCREENSHOTS,
  pictureType,
  readBugReportSubmission,
} from '@pkgs/feedback-shared-ts/bug-report';
import type {
  BugReport,
  BugReportSubmission,
  IssueReporter,
  Screenshot,
} from '@pkgs/feedback-shared-ts/types';
import { readUtf8, writeUtf8 } from '@pkgs/object-store-root-shared-ts/helpers';
import type { ObjectStore } from '@pkgs/object-store-root-shared-ts/interface';
import { bugReportIssue } from './issue-body';

/** Every device together, a day: a backstop against one sender posing as many. */
export const DAILY_BUG_REPORT_CEILING = 500;

export type IntakeOptions = {
  readonly reporter: IssueReporter;
  readonly store: ObjectStore;
  readonly clock: Clock;
  /** Where this report's pictures and JSON are read back, without a trailing slash. */
  readonly reportsUrl: string;
  /** Told why a bug report could not be received, so the team hears of it. */
  readonly onFailure?: (error: unknown) => void;
};

export type IntakeOutcome =
  | { readonly status: 200 | 201; readonly id: string }
  | { readonly status: 400 | 409 | 429 | 503; readonly error: string };

/** Where the bug reports taken from one device on one day (`2026-03-02`, UTC) are counted. */
function takenFromDevice(day: string, reporterId: string): string {
  return `limits/${day}/reporters/${reporterId}/`;
}

type Picture = { readonly contentType: string; readonly bytes: Uint8Array };

const JSON_TYPE = 'application/json';

async function readPictures(form: FormData): Promise<readonly Picture[]> {
  const files = form.getAll('screenshot');
  if (files.length > MAX_SCREENSHOTS) throw new Error('Too many screenshots');
  const pictures: Picture[] = [];
  for (const file of files) {
    if (typeof file === 'string' || file.size > MAX_SCREENSHOT_BYTES)
      throw new Error('Invalid screenshot');
    const bytes = new Uint8Array(await file.arrayBuffer());
    // Told from the bytes: what a sender calls a file is only its word.
    const contentType = pictureType(bytes);
    if (contentType === null) throw new Error('Invalid screenshot');
    pictures.push({ contentType, bytes });
  }
  return pictures;
}

async function readSubmission(
  form: FormData
): Promise<{ submission: BugReportSubmission; pictures: readonly Picture[] }> {
  const report = form.get('report');
  if (typeof report !== 'string') throw new Error('Missing bug report');
  return {
    submission: readBugReportSubmission(JSON.parse(report)),
    pictures: await readPictures(form),
  };
}

async function alreadyReceived(
  store: ObjectStore,
  submission: BugReportSubmission
): Promise<IntakeOutcome | null> {
  const archived = await readUtf8(
    store,
    `reports/${submission.id}/report.json`
  );
  if (archived === null) return null;
  const report = JSON.parse(archived) as BugReport;
  if (report.reporterId !== submission.reporterId)
    return { status: 409, error: 'Bug report id already used' };
  return (await store.head(`reports/${submission.id}/receipt.json`))
    ? { status: 200, id: submission.id }
    : null;
}

async function storePictures(
  options: IntakeOptions,
  id: string,
  pictures: readonly Picture[]
): Promise<readonly Screenshot[]> {
  const screenshots: Screenshot[] = [];
  for (const [index, picture] of pictures.entries()) {
    await options.store.put(
      `reports/${id}/screenshots/${index + 1}`,
      picture.bytes,
      picture.contentType
    );
    screenshots.push({
      contentType: picture.contentType,
      size: picture.bytes.byteLength,
      url: `${options.reportsUrl}/${id}/screenshots/${index + 1}`,
    });
  }
  return screenshots;
}

async function receive(
  options: IntakeOptions,
  submission: BugReportSubmission,
  pictures: readonly Picture[]
): Promise<IntakeOutcome> {
  const { store } = options;
  const received = await alreadyReceived(store, submission);
  if (received) return received;
  const day = new Date(options.clock.now()).toISOString().slice(0, 10);
  const own = takenFromDevice(day, submission.reporterId);
  const all = `limits/${day}/all/`;
  if ((await store.listKeys(own)).length >= DAILY_BUG_REPORT_LIMIT)
    return { status: 429, error: 'Daily bug report limit reached' };
  if ((await store.listKeys(all)).length >= DAILY_BUG_REPORT_CEILING)
    return { status: 503, error: 'Bug reports cannot be received right now' };
  const report: BugReport = {
    ...submission,
    screenshots: await storePictures(options, submission.id, pictures),
  };
  const folder = `reports/${report.id}`;
  await writeUtf8(
    store,
    `${folder}/report.json`,
    JSON.stringify(report),
    JSON_TYPE
  );
  await writeUtf8(
    store,
    `${folder}/report.md`,
    bugReportIssue(report).body,
    'text/markdown; charset=utf-8'
  );
  const issue = await options.reporter.create(report);
  await writeUtf8(
    store,
    `${folder}/receipt.json`,
    JSON.stringify(issue),
    JSON_TYPE
  );
  await writeUtf8(store, `${own}${report.id}`, '', 'text/plain');
  await writeUtf8(store, `${all}${report.id}`, '', 'text/plain');
  return { status: 201, id: report.id };
}

/**
 * Takes a bug report in and makes it an issue exactly once: a report sent
 * again, because its sender never heard back, gets the first answer.
 */
export function createBugReportIntake(options: IntakeOptions) {
  const receiving = new Map<string, Promise<IntakeOutcome>>();
  return async (form: FormData): Promise<IntakeOutcome> => {
    let input: Awaited<ReturnType<typeof readSubmission>>;
    try {
      input = await readSubmission(form);
    } catch {
      return { status: 400, error: 'Invalid bug report' };
    }
    const { id } = input.submission;
    const inFlight = receiving.get(id);
    if (inFlight) return inFlight;
    const outcome = receive(options, input.submission, input.pictures)
      .catch((error: unknown): IntakeOutcome => {
        options.onFailure?.(error);
        return {
          status: 503,
          error: 'Bug reports cannot be received right now',
        };
      })
      .finally(() => receiving.delete(id));
    receiving.set(id, outcome);
    return outcome;
  };
}
