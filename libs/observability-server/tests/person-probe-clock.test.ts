import { expect, test } from 'bun:test';
import { personProbeClock } from '@libs/observability-server/person-trouble-document';
import { parseLocalClock } from '@pkgs/observability-shared/local-clock';

const REFERENCE = '6:33 in the evening Mountain time';

// regression: health-person-traces-backdated
test('the midday Deploy run plants a searchable recent trace', () => {
  const now = Date.parse('2026-10-01T12:42:08.770Z');
  const at = personProbeClock(REFERENCE, REFERENCE, now);
  expect(parseLocalClock(at, now)?.instantMs).toBe(
    Date.parse('2026-10-01T12:42:00Z')
  );
  expect(parseLocalClock(at, now)?.timeZone).toBe('America/Phoenix');
});

test('a morning lookup stays distinct from the evening trouble across midnight', () => {
  const now = Date.parse('2026-10-02T01:42:00Z');
  const at = personProbeClock(
    '9:00 in the morning Mountain time',
    REFERENCE,
    now
  );
  expect(parseLocalClock(at, now)?.instantMs).toBe(
    now - (9 * 60 + 33) * 60_000
  );
});

test('invalid clocks are refused', () => {
  expect(() => personProbeClock('9:00', REFERENCE, 0)).toThrow('needs a zone');
});
