import { describe, expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import type { BugReportSubmission } from '@pkgs/feedback-shared-ts/types';
import type { HttpClient } from '@pkgs/http-client-shared-ts/types';
import {
  bugReportEndpoint,
  createBugReportSender,
  SEND_DEADLINE_MS,
} from '../src/sender';
import { PNG } from './support';

const SUBMISSION: BugReportSubmission = {
  schema: 'bug-report/v1',
  id: '2f1c8f0e-6f1f-4e0b-9d59-1f6f1c0a8b11',
  reporterId: '7b0e3c52-0d6a-4f43-8a55-5d1d4a4a2c9e',
  description: 'The board froze',
  createdAt: '2026-11-11T10:00:00.000Z',
  debugInfo: { events: [], details: [] },
};

function sender(http: HttpClient) {
  const { clock, timers } = createHarnessClock();
  return {
    clock,
    send: createBugReportSender({ http, endpoint: '/api/bug-reports', timers }),
  };
}

describe('sending a bug report', () => {
  // regression: feedback-http-ignores-abort
  // regression: feedback-evidence-ignores-abort
  test('answers by the deadline over a connection that ignores being cancelled', async () => {
    let signal: AbortSignal | null | undefined;
    const { clock, send } = sender({
      fetch(_input, init) {
        signal = init?.signal;
        return new Promise(() => undefined);
      },
    });
    const sending = send(SUBMISSION, [
      { contentType: 'image/png', bytes: PNG },
    ]);
    clock.advance(SEND_DEADLINE_MS);
    expect(await sending).toBe('later');
    expect(signal?.aborted).toBe(true);
  });

  test('sends the report and its pictures without the person’s sign-in', async () => {
    const requests: RequestInit[] = [];
    const { send } = sender({
      fetch(_input, init) {
        requests.push(init ?? {});
        return Promise.resolve(new Response(null, { status: 201 }));
      },
    });
    expect(
      await send(SUBMISSION, [{ contentType: 'image/png', bytes: PNG }])
    ).toBe('sent');
    const request = requests[0];
    const form = request?.body as FormData;
    expect(request?.credentials).toBe('omit');
    expect(JSON.parse(form.get('report') as string)).toEqual(SUBMISSION);
    expect(form.getAll('screenshot')).toHaveLength(1);
  });

  test.each([
    [201, 'sent'],
    [429, 'limit'],
    [400, 'failed'],
    [409, 'failed'],
    [413, 'failed'],
    [500, 'later'],
    [503, 'later'],
    [404, 'later'],
  ] as const)('an answer of %i means %s', async (status, outcome) => {
    const { send } = sender({
      fetch: () => Promise.resolve(new Response(null, { status })),
    });
    expect(await send(SUBMISSION, [])).toBe(outcome);
  });

  test('a connection that breaks means later, never an error', async () => {
    const { send } = sender({
      fetch: () => Promise.reject(new TypeError('Failed to fetch')),
    });
    expect(await send(SUBMISSION, [])).toBe('later');
  });

  test.each([400, 409, 413, 415])(
    'an answer of %i means the bug report can never be sent as it is',
    async (status) => {
      const { send } = sender({
        fetch: () => Promise.resolve(new Response(null, { status })),
      });
      expect(await send(SUBMISSION, [])).toBe('failed');
    }
  );

  test('a malformed app address still reaches bug reporting', () => {
    expect(bugReportEndpoint('https://api.example.com')).toBe(
      'https://api.example.com/api/bug-reports'
    );
    expect(bugReportEndpoint('not an address')).toBe('/api/bug-reports');
  });
});
