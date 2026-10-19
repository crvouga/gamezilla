import { expect, test } from 'bun:test';
import type { Denial } from '@pkgs/aedes-server/start';
import { brokerVerdict } from './broker-denials';

const refused = (
  operation: Denial['operation'],
  topic: string | null
): Denial => ({ operation, clientId: 'device', topic });

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

test('a person or room a fresh token grants is waited for, not failed', () => {
  expect(
    brokerVerdict([
      refused('subscribe', 'user:signed-in-account'),
      refused('subscribe', 'room:new-space'),
      refused('publish', 'room:new-space'),
    ]).ok
  ).toBe(true);
});

test('a refused connection fails the run', () => {
  expect(brokerVerdict([refused('connect', null)]).ok).toBe(false);
});

test('no refusals pass', () => {
  expect(brokerVerdict([])).toEqual({ ok: true, violations: [] });
});
