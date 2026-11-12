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
  BugReportStore,
  BugReportSubmission,
  Screenshot,
} from '@pkgs/feedback-shared-ts/types';

/** Every device together, a day: a backstop against one sender posing as many. */
export const DAILY_BUG_REPORT_CEILING = 500;

export type IntakeOptions = {
  readonly store: BugReportStore;
  readonly clock: Clock;
  /** Where this report's pictures and JSON are read back, without a trailing slash. */
  readonly reportsUrl: string;
  /** Told why a bug report could not be received, so the team hears of it. */
  readonly onFailure?: (error: unknown) => void;
};

export type IntakeOutcome =
  | { readonly status: 200 | 201; readonly id: string }
  | { readonly status: 400 | 409 | 429 | 503; readonly error: string };

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

/** The device a report kept but never recorded came from, if any. */
async function keptSender(
  store: BugReportStore,
  id: string
): Promise<string | null> {
  const kept = await store.attachments.get(id, 'report.json');
  if (!kept) return null;
  const text = await new Response(kept.body).text();
  return (JSON.parse(text) as BugReport).reporterId;
}

async function alreadyReceived(
  store: BugReportStore,
  submission: BugReportSubmission
): Promise<IntakeOutcome | null> {
  const sender = (await store.records.find(submission.id))?.reporterId ?? null;
  if (sender === submission.reporterId)
    return { status: 200, id: submission.id };
  const used = sender ?? (await keptSender(store, submission.id));
  return used !== null && used !== submission.reporterId
    ? { status: 409, error: 'Bug report id already used' }
    : null;
}

async function storePictures(
  options: IntakeOptions,
  id: string,
  pictures: readonly Picture[]
): Promise<readonly Screenshot[]> {
  const screenshots: Screenshot[] = [];
  for (const [index, picture] of pictures.entries()) {
    await options.store.attachments.put(
      id,
      `screenshots/${index + 1}`,
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
  const counted = await store.records.countOnDay(day, submission.reporterId);
  if (counted.fromDevice >= DAILY_BUG_REPORT_LIMIT)
    return { status: 429, error: 'Daily bug report limit reached' };
  if (counted.total >= DAILY_BUG_REPORT_CEILING)
    return { status: 503, error: 'Bug reports cannot be received right now' };
  const report: BugReport = {
    ...submission,
    screenshots: await storePictures(options, submission.id, pictures),
  };
  await store.attachments.put(
    report.id,
    'report.json',
    new TextEncoder().encode(JSON.stringify(report)),
    JSON_TYPE
  );
  await store.records.record(report);
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
