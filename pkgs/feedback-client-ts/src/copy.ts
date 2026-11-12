import {
  DAILY_BUG_REPORT_LIMIT,
  MAX_SCREENSHOTS,
} from '@pkgs/feedback-shared-ts/bug-report';

/**
 * Bug reporting speaks plain English from its own words: it must still make
 * sense when the app around it, its translations included, has failed.
 */
export type BugReportNotice =
  | 'describe'
  | 'sent'
  | 'offline'
  | 'later'
  | 'limit'
  | 'failed'
  | 'too-many'
  | 'not-a-picture'
  | 'too-large';

const NOTICE: Record<BugReportNotice, string> = {
  describe: 'Describe the bug before sending.',
  sent: 'Thank you. The team has your bug report.',
  offline:
    'You are offline. Your bug report will be sent when you are back online.',
  later: 'Your bug report is kept and will be sent later.',
  limit: `You have reached the limit of ${DAILY_BUG_REPORT_LIMIT} bug reports a day. Send this one tomorrow.`,
  failed:
    'Your bug report could not be sent. Try again, or remove a screenshot first.',
  'too-many': `A bug report carries at most ${MAX_SCREENSHOTS} screenshots.`,
  'not-a-picture': 'Only pictures can be added.',
  'too-large': 'That picture is too large. Pictures can be up to 5 MB.',
};

export function noticeText(notice: BugReportNotice): string {
  return NOTICE[notice];
}

export function waitingText(count: number): string {
  return count === 1
    ? '1 bug report is waiting to be sent.'
    : `${count} bug reports are waiting to be sent.`;
}

export const DEBUG_INFO_NOTE =
  'This bug report includes debug info: where you went and what you chose in the last 5 minutes, any trouble the app ran into, your device and the app version. It never includes what you typed.';

export const SHAKE_REFUSED =
  'This phone does not allow the app to notice shaking. Choose Report a bug instead.';
