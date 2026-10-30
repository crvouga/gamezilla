import { expect, test } from 'bun:test';
import { browserFailureLog } from '@apps/product-ts/browser-failure-summary';

// regression: journey-failure-screen-truncated
// Shard 42 lost the host's Numberlink screen behind two transport dumps.
test('a bounded CI log tail retains both device screens after transport evidence', () => {
  const host = 'browser failure state (host): content-author';
  const peer = 'browser failure state (peer): puzzle-content-edition';
  const transport = Array.from(
    { length: 120 },
    (_, index) => `request ${index}: ${'SQL evidence '.repeat(100)}`
  ).join('\n');
  const log = browserFailureLog([transport, transport], [host, peer]);
  const retained = log.slice(-2000);
  expect(retained).toContain(host);
  expect(retained).toContain(peer);
  expect(log).toContain(transport);
});
