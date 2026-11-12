import type { Timers } from '@pkgs/clock-shared-ts/types';
import type {
  BugReportSubmission,
  ScreenshotFile,
} from '@pkgs/feedback-shared-ts/types';
import type { HttpClient } from '@pkgs/http-client-shared-ts/types';

/**
 * `sent`: the team has it. `limit`: today's limit is reached. `later`: it
 * could not get through now and may later. `failed`: it never will as it is.
 */
export type SendOutcome = 'sent' | 'limit' | 'later' | 'failed';

export type SendBugReport = (
  submission: BugReportSubmission,
  pictures: readonly ScreenshotFile[]
) => Promise<SendOutcome>;

export const SEND_DEADLINE_MS = 60_000;

function outcomeOf(status: number): SendOutcome {
  if (status >= 200 && status < 300) return 'sent';
  if (status === 429) return 'limit';
  return [400, 409, 413, 415].includes(status) ? 'failed' : 'later';
}

/**
 * Sends one bug report with its pictures. It always answers within the
 * deadline, even over a connection that never answers or ignores being
 * cancelled, and it never sends the person's sign-in along.
 */
export function createBugReportSender(options: {
  readonly http: HttpClient;
  readonly endpoint: string;
  readonly timers: Timers;
  readonly deadlineMs?: number;
}): SendBugReport {
  return (submission, pictures) =>
    new Promise((resolve) => {
      const controller = new AbortController();
      let settled = false;
      const finish = (outcome: SendOutcome): void => {
        if (settled) return;
        settled = true;
        options.timers.clearTimeout(handle);
        resolve(outcome);
      };
      const handle = options.timers.setTimeout(() => {
        finish('later');
        controller.abort();
      }, options.deadlineMs ?? SEND_DEADLINE_MS);
      const form = new FormData();
      form.set('report', JSON.stringify(submission));
      for (const picture of pictures)
        form.append(
          'screenshot',
          new Blob([picture.bytes as Uint8Array<ArrayBuffer>], {
            type: picture.contentType,
          }),
          'screenshot'
        );
      Promise.resolve()
        .then(() =>
          options.http.fetch(options.endpoint, {
            method: 'POST',
            body: form,
            credentials: 'omit',
            signal: controller.signal,
          })
        )
        .then(
          (response) => finish(outcomeOf(response.status)),
          () => finish('later')
        );
    });
}

/** Bug reporting stays reachable when the app's own configuration is malformed. */
export function bugReportEndpoint(
  base: string,
  path = '/api/bug-reports'
): string {
  try {
    return new URL(path, base).href;
  } catch {
    return path;
  }
}
