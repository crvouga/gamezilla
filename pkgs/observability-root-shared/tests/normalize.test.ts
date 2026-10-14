import { expect, test } from 'bun:test';
import { normalizeSpan } from '@pkgs/observability-root-shared/normalize';

// regression: otlp-integer-attributes-read-as-text
test('OTLP integer fields retain their numeric meaning without rounding large identifiers', () => {
  const span = normalizeSpan({
    traceId: '11111111111111111111111111111111',
    spanId: '2222222222222222',
    name: 'request',
    startTimeUnixNano: '1700000000000000000',
    endTimeUnixNano: '1700000000001000000',
    attributes: [
      { key: 'http.response.status_code', value: { intValue: '200' } },
      { key: 'large-id', value: { intValue: '9223372036854775807' } },
      { key: 'text', value: { stringValue: '200' } },
    ],
  });
  expect(span?.attributes['http.response.status_code']).toBe(200);
  expect(span?.attributes['large-id']).toBe('9223372036854775807');
  expect(span?.attributes['text']).toBe('200');
});
