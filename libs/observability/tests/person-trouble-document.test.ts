import { describe, expect, test } from 'bun:test';
import { personTroubleDocument } from '@libs/observability/server/person-trouble-document';

const NOW_MS = Date.parse('2026-09-29T02:00:00.000Z');

describe('a planted person', () => {
  test('writes the crash on their own clock and the connection somewhere else', () => {
    const document = personTroubleDocument({
      name: 'Alice',
      place: 'Las Vegas',
      at: '6:33 in the evening Mountain time',
      nowMs: NOW_MS,
      userId: 'user-alice',
      crashTraceId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      crashSpanId: 'bbbbbbbbbbbbbbbb',
      requestTraceId: 'cccccccccccccccccccccccccccccccc',
      requestSpanId: 'dddddddddddddddd',
    });
    const text = JSON.stringify(document);
    expect(text).toContain('user-alice');
    expect(text).toContain('America/Phoenix');
    expect(text).toContain('Las Vegas');
    expect(text).toContain('"code":2');
    expect(text).toContain(
      String(Date.parse('2026-09-29T01:33:00.000Z') * 1_000_000)
    );
    expect(document.resourceSpans).toHaveLength(2);
  });
});