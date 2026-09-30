// @io-wall-ok — live health: a planted person, then the trail the team follows.
/** `specs/health/finding-a-person.feature` (skipped with `OBSERVABILITY_ENABLED=0`). */

import { expect } from 'bun:test';
import { ObservabilitySecretName as Name } from '@libs/observability/public/secret-names';
import {
  plantPersonTrouble,
  readPersonTrouble,
} from '@libs/observability/server/person-trouble-probe';
import type {
  PersonPlant,
  PersonProbeCredentials,
  PersonRead,
  PersonReadResult,
} from '@libs/observability/server/person-trouble-probe';
import { wallClock } from '@pkgs/clock';
import { eventually, Given, Then, When } from './define';
import { requireSecret, type LiveWorld } from './live-world';
import { wallWait } from './wall-wait';

const TOKEN_WARMUP_MS = 3 * 60 * 1000;
const RETRY_MS = 10_000;
const PLANT = 'person-plant';
const QUESTION = 'person-question';

type Question = {
  readonly at: string;
  readonly name: string;
  readonly place: string;
};

function credentials(): PersonProbeCredentials {
  return {
    collectorUrl: requireSecret(Name.collectorUrl),
    collectorUser: requireSecret(Name.collectorUser),
    collectorToken: requireSecret(Name.collectorToken),
    tempoUrl: requireSecret(Name.tempoUrl),
    tempoUser: requireSecret(Name.tempoUser),
    tempoToken: requireSecret(Name.tempoToken),
  };
}

function hex(bytes: number): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, bytes);
}

Given(
  '{string} ran into trouble in {string} at {string}',
  async (w, name: string, place: string, at: string) => {
    const plant: PersonPlant = {
      name,
      place,
      at,
      nowMs: wallClock.now(),
      userId: crypto.randomUUID(),
      crashTraceId: hex(32),
      crashSpanId: hex(16),
      requestTraceId: hex(32),
      requestSpanId: hex(16),
    };
    const accepted = await plantPersonTrouble(w.http, credentials(), plant);
    expect(accepted, 'the trail did not accept what happened').toBe(true);
    w.memo.set(PLANT, plant);
  }
);

When(
  'the team follows the trail for {string} in {string} at {string}',
  (w, name: string, place: string, at: string) => {
    const question: Question = { name, place, at };
    w.memo.set(QUESTION, question);
  }
);

Then('the team sees what went wrong for {string}', async (w, name: string) => {
  const report = await untilSeen(w, readFor(w, questionOf(w)));
  expect(report?.sawTrouble, `nothing came back for ${name}`).toBe(true);
  expect(report?.text).toContain(name);
});

Then(
  'the team is told nothing happened for {string} at that time',
  async (w, name: string) => {
    const plant = plantOf(w);
    const visible = await untilSeen(w, readFor(w, plant));
    expect(visible?.sawTrouble, 'the evening trail was not readable yet').toBe(
      true
    );
    const report = await readPersonTrouble(
      w.http,
      credentials(),
      readFor(w, questionOf(w))
    );
    expect(report.sawTrouble).toBe(false);
    expect(report.text).toContain(`Nothing happened for ${name} at that time.`);
  }
);

function plantOf(w: LiveWorld): PersonPlant {
  const value = w.memo.get(PLANT);
  if (!isPlant(value)) throw new Error('nobody has run into trouble yet');
  return value;
}

function questionOf(w: LiveWorld): Question {
  const value = w.memo.get(QUESTION);
  if (!isQuestion(value)) throw new Error('the team has not followed the trail yet');
  return value;
}

function readFor(w: LiveWorld, question: Question): PersonRead {
  const plant = plantOf(w);
  return {
    name: question.name,
    place: question.place,
    at: question.at,
    nowMs: plant.nowMs,
    userId: plant.userId,
  };
}

async function untilSeen(
  w: LiveWorld,
  question: PersonRead
): Promise<PersonReadResult | undefined> {
  let found: PersonReadResult | undefined;
  const visible = await eventually(
    async () => {
      const report = await readPersonTrouble(w.http, credentials(), question);
      if (!report.sawTrouble) return false;
      found = report;
      return true;
    },
    { maxWaitMs: TOKEN_WARMUP_MS, retryMs: RETRY_MS, ...wallWait }
  );
  return visible ? found : undefined;
}

function isPlant(value: unknown): value is PersonPlant {
  if (value === null || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item['userId'] === 'string' &&
    typeof item['nowMs'] === 'number' &&
    typeof item['at'] === 'string'
  );
}

function isQuestion(value: unknown): value is Question {
  if (value === null || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item['name'] === 'string' &&
    typeof item['place'] === 'string' &&
    typeof item['at'] === 'string'
  );
}
