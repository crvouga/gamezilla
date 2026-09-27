import { expect, test } from 'bun:test';
import {
  failedTestTraceMarkdown,
  failedTestTracesFromNdjson,
} from './workflow-observability';

const TRACE_ID = '11111111111111111111111111111111';
const SPAN_ID = '2222222222222222';

test('renders exact test, trace, and span commands from failure artifacts', () => {
  const failures = failedTestTracesFromNdjson(
    JSON.stringify({
      traceId: TRACE_ID,
      spanId: SPAN_ID,
      name: 'test.failure',
      status: 'error',
      statusMessage: 'replicas differed',
      attributes: {
        'app.test.id': 'offline edits converge',
        'app.test.file': 'tests/e2e/offline.test.ts',
        'app.test.package': '@libs/sync',
      },
    })
  );
  const markdown = failedTestTraceMarkdown(failures, '73');
  expect(markdown).toContain(
    "bun obs test 'offline edits converge' --source artifacts --last-failure"
  );
  expect(markdown).toContain(`bun obs trace ${TRACE_ID} --source artifacts`);
  expect(markdown).toContain(
    `bun obs span ${TRACE_ID} ${SPAN_ID} --source artifacts`
  );
  expect(markdown).toContain('failure: replicas differed');
});

test('ignores unrelated and incomplete records', () => {
  const failures = failedTestTracesFromNdjson(
    `${JSON.stringify({ name: 'request.handle', status: 'error' })}\n{"partial"`
  );
  expect(failures).toEqual([]);
});
