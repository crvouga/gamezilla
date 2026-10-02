import { expect, test } from 'bun:test';
import type { JoinResult, StatusResult } from '@pkgs/matchmaking/interface';
import { serializeFormula } from '@pkgs/matchmaking/interface';
import {
  httpRequest,
  lastHttp,
  matchmaking,
  NameAttr,
  RatingAttr,
  ratingWithin,
  tick,
} from '@pkgs/matchmaking-harness';

// regression: matchmaking-wire-radius-discarded
test('Alice accepts five points over HTTP while Bob fifty points away accepts two hundred', async () => {
  await using s = await matchmaking.run({
    seed: 'wire-radius',
    args: { replicas: 3 },
  });
  await s.apply(httpRequest, {
    path: '/join',
    method: 'POST',
    headers: { 'x-test-user': 'alice' },
    body: {
      requestId: 'alice-1',
      data: { ...NameAttr('alice'), ...RatingAttr(1000) },
      formulas: [serializeFormula(ratingWithin(5))],
    },
  });
  const alice = ((await s.read(lastHttp)) as { body: JoinResult }).body;
  await s.apply(httpRequest, {
    path: '/join',
    method: 'POST',
    headers: { 'x-test-user': 'bob' },
    body: {
      requestId: 'bob-1',
      data: { ...NameAttr('bob'), ...RatingAttr(1050) },
      formulas: [serializeFormula(ratingWithin(200))],
    },
  });
  await s.apply(tick, {});
  await s.apply(httpRequest, {
    path: `/status/${alice.participantId}`,
    headers: { 'x-test-user': 'alice' },
  });
  const view = (await s.read(lastHttp)) as {
    status: number;
    body: StatusResult;
  };
  expect(view.status).toBe(200);
  expect(view.body.status).toBe('waiting');
});
