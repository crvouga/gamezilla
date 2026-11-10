import { expect, test } from 'bun:test';
import { onSchedule } from '@libs/synthetic-population-shared-ts/daily-schedule';
import {
  type Persona,
  parsePersona,
  personaRandom,
  personaSchema,
  provisionPersona,
  readPersona,
} from '@libs/synthetic-population-shared-ts/persona';
import { usernameFitsPopulation } from '@libs/synthetic-population-shared-ts/persona-usernames';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

const GAMES = ['first-game', 'second-game', 'third-game', 'fourth-game'];
const START = Date.parse('2024-06-01T00:00:00.000Z');

function population(ids: readonly string[], nowMs = START): Persona[] {
  const personas: Persona[] = [];
  for (const id of ids)
    personas.push(
      provisionPersona(id, personaRandom(id), {
        games: GAMES,
        population: personas,
        nowMs,
      })
    );
  return personas;
}

test('the same identity always provisions the same complete persona, online now', () => {
  assertProperty(
    'persona provisioning',
    fc.property(
      fc.uuid(),
      fc.integer({ min: START, max: START + 365 * 86_400_000 }),
      (id, nowMs) => {
        const context = { games: GAMES, population: [], nowMs };
        const persona = provisionPersona(id, personaRandom(id), context);
        expect(personaSchema.parse(persona)).toEqual(persona);
        expect(provisionPersona(id, personaRandom(id), context)).toEqual(
          persona
        );
        expect(onSchedule(persona.dailySchedule, nowMs)).toBe(true);
        expect(persona.thinkingTime.minMs).toBeLessThan(
          persona.thinkingTime.maxMs
        );
        expect(/^[A-Za-z0-9_]{3,24}$/.test(persona.username)).toBe(true);
        for (const game of persona.favoriteGames) expect(GAMES).toContain(game);
      }
    )
  );
});

test('a population of any size never repeats a username and stays varied', () => {
  assertProperty(
    'varied population',
    fc.property(
      fc.uniqueArray(fc.uuid(), { minLength: 12, maxLength: 40 }),
      (ids) => {
        const personas = population(ids);
        const usernames = personas.map((p) => p.username.toLowerCase());
        expect(new Set(usernames).size).toBe(usernames.length);
        expect(new Set(personas.map((p) => p.skillLevel)).size).toBe(4);
        expect(
          new Set(personas.flatMap((p) => p.favoriteGames)).size
        ).toBeGreaterThanOrEqual(3);
        personas.forEach((persona, index) => {
          expect(
            usernameFitsPopulation(
              persona.username,
              personas.slice(0, index).map((p) => p.username)
            )
          ).toBe(true);
        });
      }
    )
  );
});

test('usernames that share a pattern do not fit a population', () => {
  expect(usernameFitsPopulation('rook1987', ['rook1992'])).toBe(false);
  expect(usernameFitsPopulation('MayaK', ['maya_k'])).toBe(false);
  expect(usernameFitsPopulation('quiet_otter', ['quiet_fox', 'quill7'])).toBe(
    false
  );
  expect(usernameFitsPopulation('quiet_otter', ['quiet_fox'])).toBe(true);
  expect(usernameFitsPopulation('Cedar', ['cedar'])).toBe(false);
});

test('a row stored before personas is upgraded, keeping its username and hosting weight', () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const context = { games: GAMES, population: [], nowMs: START };
  const upgraded = readPersona(
    JSON.stringify({ hostingWeight: 0.15, skill: 'beginner' }),
    { id, username: 'cedar1a2b3c4d' },
    context
  );
  expect(personaSchema.parse(upgraded).username).toBe('cedar1a2b3c4d');
  expect(upgraded.hostingWeight).toBe(0.15);
  expect(readPersona(upgraded, { id, username: 'other' }, context)).toEqual(
    upgraded
  );
  expect(parsePersona(JSON.stringify(upgraded))).toEqual(upgraded);
  expect(parsePersona({ hostingWeight: 0.2, skill: 'beginner' })).toBeNull();
});
