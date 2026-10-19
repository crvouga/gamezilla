import { expect, test } from 'bun:test';
import type { Denial } from '@pkgs/aedes-server/start';
import { brokerVerdict } from './broker-denials';

const refused = (
  operation: Denial['operation'],
  topic: string | null,
  options: { clientId?: string; cured?: boolean } = {}
): Denial => ({
  operation,
  clientId: options.clientId ?? 'device',
  topic,
  cured: options.cured ?? false,
});

// regression: ungranted-system-topic-passes-pull-request
test('a topic no token grants fails the run, however often the device retried', () => {
  const verdict = brokerVerdict([
    refused('subscribe', 'system:chess_puzzles'),
    refused('subscribe', 'system:chess_puzzles'),
  ]);
  expect(verdict.ok).toBe(false);
  expect(verdict.violations).toHaveLength(1);
  expect(verdict.violations[0]).toContain('subscribe system:chess_puzzles');
  expect(verdict.violations[0]).toContain('2 time(s)');
});

test('a person or room a fresh token granted is waited for, not failed', () => {
  expect(
    brokerVerdict([
      refused('subscribe', 'user:signed-in-account', { cured: true }),
      refused('subscribe', 'user:signed-in-account', { cured: true }),
      refused('subscribe', 'room:new-space', { cured: true }),
      refused('publish', 'room:new-space', { cured: true }),
    ]).ok
  ).toBe(true);
});

test('one refusal still standing when the run ends may only be the last stale token', () => {
  expect(brokerVerdict([refused('subscribe', 'room:new-space')]).ok).toBe(true);
});

// regression: push-subscribes-to-other-peoples-user-topics
test("another person's topic no token granted fails the run once the device asks again", () => {
  const verdict = brokerVerdict([
    refused('subscribe', 'user:alice', { clientId: 'bob-phone' }),
    refused('subscribe', 'user:alice', { clientId: 'bob-phone' }),
    refused('subscribe', 'user:alice', { clientId: 'bob-phone' }),
  ]);
  expect(verdict.ok).toBe(false);
  expect(verdict.violations).toHaveLength(1);
  expect(verdict.violations[0]).toContain('subscribe user:alice by bob-phone');
  expect(verdict.violations[0]).toContain('3 time(s)');
});

test('two devices each refused once are not a loop', () => {
  expect(
    brokerVerdict([
      refused('subscribe', 'room:new-space', { clientId: 'alice-phone' }),
      refused('subscribe', 'room:new-space', { clientId: 'bob-phone' }),
    ]).ok
  ).toBe(true);
});

test('a refused connection fails the run', () => {
  expect(brokerVerdict([refused('connect', null)]).ok).toBe(false);
});

test('no refusals pass', () => {
  expect(brokerVerdict([])).toEqual({ ok: true, violations: [] });
});
