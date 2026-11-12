// @io-wall-ok — live health: the environment's bug report intake.
/** `specs/feedback/receiving-bug-reports.feature`. */

import { expect } from 'bun:test';
import { Then } from './define';

/** The intake says why it cannot receive, so the reason is the failure's message. */
Then('the team can receive bug reports in this environment', async (w) => {
  const response = await w.http.fetch(
    `${w.origins.api}/api/bug-reports/health`
  );
  const answer = { status: response.status, body: await response.text() };
  expect(answer).toEqual({ status: 200, body: '{"receiving":true}' });
});
