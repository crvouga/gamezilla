import { expect, test } from 'bun:test';
import {
  personalitySchema,
  provisionPersonality,
  readPersonality,
} from '@libs/synthetic-population-shared/personality';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';

test('persistent identities reproduce bounded personalities across versions', () => {
  assertProperty(
    'persistent personality',
    fc.property(fc.uuid(), (identity) => {
      const personality = provisionPersonality(identity);
      expect(personalitySchema.safeParse(personality).success).toBe(true);
      expect(readPersonality(JSON.parse(JSON.stringify(personality)))).toEqual(
        personality
      );
      expect(provisionPersonality(identity)).toEqual(personality);
    })
  );
  expect(
    provisionPersonality('00000000-0000-4000-8000-000000000001').hostingWeight
  ).toBe(0.15);
  expect(
    provisionPersonality('ff000000-0000-4000-8000-000000000001').hostingWeight
  ).toBe(0.5);
  expect(readPersonality({ skill: 'unknown' })).toEqual({
    hostingWeight: 0.3,
    skill: 'beginner',
  });
});
