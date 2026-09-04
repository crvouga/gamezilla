/**
 * Shared fixtures for matchmaking sim / adapter tests.
 * No Postgres / SqlClient / adapter imports.
 */

import { expect } from 'bun:test';
import { Assert } from '@pkgs/assert';
import { createAttrNamespace } from '@pkgs/attribute';
import type { MatchedStatus } from '@pkgs/matchmaking/interface';

export const testNs = createAttrNamespace('mmtest');

export const RatingAttr = testNs.number('rating', (v): number => {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error('mmtest/rating must be a finite number');
  }
  return v;
});

export const SkillAttr = testNs.number('skill', (v): number => {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error('mmtest/skill must be a finite number');
  }
  return v;
});

export const NameAttr = testNs.text('name', (v): string =>
  typeof v === 'string' ? v : ''
);

export const RegionAttr = testNs.textOrNull('region', (v): string | null =>
  typeof v === 'string' ? v : null
);

export const KindAttr = testNs.text('kind', (v): string => {
  if (typeof v !== 'string' || v.length === 0) {
    throw new Error('mmtest/kind must be a non-empty string');
  }
  return v;
});

export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function registerTestCrashHandler(): () => void {
  return Assert.registerCrashHandler({
    priority: 0,
    match: () => true,
    crash(message, context) {
      throw new Error(
        context === undefined
          ? message
          : `${String(message)} ${JSON.stringify(context)}`
      );
    },
  });
}

export function expectMatched(status: unknown): MatchedStatus {
  expect(status).not.toBeNull();
  const narrowed = status as MatchedStatus;
  expect(narrowed.status).toBe('matched');
  return narrowed;
}
