import { expect, test } from 'bun:test';
import { httpRequest, tick } from '@pkgs/matchmaking-root-harness-ts/actions';
import {
  NameAttr,
  RatingAttr,
  ratingWithin,
} from '@pkgs/matchmaking-root-harness-ts/attrs';
import { lastHttp } from '@pkgs/matchmaking-root-harness-ts/observations';
import { matchmaking } from '@pkgs/matchmaking-root-harness-ts/system';
import { serializeFormula } from '@pkgs/matchmaking-root-shared-ts/formula-wire';
import type {
  JoinResult,
  StatusResult,
} from '@pkgs/matchmaking-root-shared-ts/types';

// regression: matchmaking-incomplete-wait-blocks-pairing
// Carol waits without a rating, ahead of Alice and Bob who are compatible.
// Comparing Carol's missing rating threw out of the pairing pass, so
// nobody was paired.
test('a wait missing its rating cannot block two compatible people', async () => {
  await using s = await matchmaking.run({
    seed: 'incomplete-wait',
    args: { replicas: 1 },
  });
  const people = [
    { person: 'carol', data: NameAttr('carol') },
    { person: 'alice', data: { ...NameAttr('alice'), ...RatingAttr(1000) } },
    { person: 'bob', data: { ...NameAttr('bob'), ...RatingAttr(1050) } },
  ];
  const ids = new Map<string, string>();
  for (const { person, data } of people) {
    await s.apply(httpRequest, {
      path: '/join',
      method: 'POST',
      headers: { 'x-test-user': person },
      body: {
        requestId: `${person}-1`,
        data,
        formulas: [serializeFormula(ratingWithin(200))],
      },
    });
    const joined = ((await s.read(lastHttp)) as { body: JoinResult }).body;
    ids.set(person, joined.participantId!);
    await s.advanceTime(1);
  }
  await s.apply(tick, {});
  const statusFor = async (person: string): Promise<string | undefined> => {
    await s.apply(httpRequest, {
      path: `/status/${ids.get(person)!}`,
      headers: { 'x-test-user': person },
    });
    return ((await s.read(lastHttp)) as { body: StatusResult }).body.status;
  };
  expect(await statusFor('alice')).toBe('matched');
  expect(await statusFor('bob')).toBe('matched');
  expect(await statusFor('carol')).toBe('waiting');
});
