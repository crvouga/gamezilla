/**
 * `specs/feedback/daily-bug-report-limit.dmn` against the team's side:
 *
 * - server enforcement — the real intake, holding the bug reports the case
 *   says the team took from the device today and before today, is sent one
 *   more by the case's person, guest or signed in: taken means yes, refused
 *   for the day means the daily bug report limit is reached.
 */

import { bindDecisions } from '@pkgs/dmn-shared-ts/registry';
import {
  createBugReportIntake,
  takenFromDevice,
} from '@pkgs/feedback-server-ts/bug-report-intake';
import type { BugReportSubmission } from '@pkgs/feedback-shared-ts/types';
import { writeUtf8 } from '@pkgs/object-store-root-shared-ts/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';

const NOW_MS = Date.parse('2026-03-02T10:00:00.000Z');
const DAY_MS = 24 * 60 * 60_000;
const DEVICE = '22222222-2222-4222-8222-222222222222';
const PER_EARLIER_DAY = 10;

const dayOf = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

function reportId(index: number): string {
  return `11111111-1111-4111-8111-${String(index).padStart(12, '0')}`;
}

/** One more bug report from the device, saying who is using it as the app does. */
function oneMore(who: string): FormData {
  const submission: BugReportSubmission = {
    schema: 'bug-report/v1',
    id: reportId(0),
    reporterId: DEVICE,
    description: 'The board froze after a move',
    createdAt: new Date(NOW_MS).toISOString(),
    debugInfo: {
      events: [],
      details: [
        {
          name: 'account',
          status: 'available',
          value: who === 'signed-in person' ? { id: 'account-alice' } : {},
        },
      ],
    },
  };
  const form = new FormData();
  form.set('report', JSON.stringify(submission));
  return form;
}

bindDecisions({
  spec: 'daily-bug-report-limit',
  layers: {
    'server enforcement': {
      async decide(input) {
        const store = new ObjectStoreImplInMemory();
        const today = Number(
          input['bug reports the team took from this device today']
        );
        const earlier = Number(
          input['bug reports the team took from this device before today']
        );
        for (let taken = 1; taken <= today; taken++)
          await writeUtf8(
            store,
            `${takenFromDevice(dayOf(NOW_MS), DEVICE)}${reportId(taken)}`,
            '',
            'text/plain'
          );
        for (let taken = 1; taken <= earlier; taken++) {
          const daysAgo = Math.ceil(taken / PER_EARLIER_DAY);
          await writeUtf8(
            store,
            `${takenFromDevice(dayOf(NOW_MS - daysAgo * DAY_MS), DEVICE)}${reportId(today + taken)}`,
            '',
            'text/plain'
          );
        }
        const intake = createBugReportIntake({
          reporter: { create: (report) => Promise.resolve({ id: report.id }) },
          store,
          clock: { now: () => NOW_MS },
          reportsUrl: 'https://app.example/api/bug-reports/reports',
        });
        const outcome = await intake(oneMore(String(input['who is sending'])));
        if ('id' in outcome) return { answer: 'yes', reason: 'none' };
        return {
          answer: 'no',
          reason:
            outcome.status === 429
              ? 'daily bug report limit reached'
              : outcome.error,
        };
      },
    },
  },
});
