// goal:guest-free-and-paid:5
import { describe, expect, test } from 'bun:test';

import {
  can,
  checkLimit,
  createSubject,
  definePolicy,
} from '@pkgs/permissions';

const roles = Object.fromEntries(
  Array.from({ length: 64 }, (_, index) => {
    const role = `role-${index}`;
    const grants: string[] = [];
    const permissions = Array.from(
      { length: 4 },
      (_, permissionIndex) => `permission:${index * 4 + permissionIndex}`
    );
    return [
      role,
      {
        grants,
        permissions,
        limits: { [`limit:${index}`]: index + 1 },
      },
    ];
  })
) as Record<
  string,
  {
    grants: string[];
    permissions: string[];
    limits: Record<string, number>;
  }
>;

const policy = definePolicy({ roles });
const subject = createSubject(['role-0', 'role-16', 'role-32', 'role-48']);
const permission = 'permission:64';
const limit = 'limit:48';

/**
 * The evaluator is intentionally exercised against the parser's maximum role
 * cardinality and a multi-role subject. This is a deterministic guard against
 * accidentally making entitlement checks scale with policy size.
 */
describe('permission evaluation cost', () => {
  test('10,000 mixed checks stay below the interactive budget', () => {
    for (let i = 0; i < 250; i += 1) {
      can(policy, subject, permission);
      checkLimit(policy, subject, limit, i);
    }

    const start = performance.now();
    let allowedCount = 0;
    for (let i = 0; i < 10_000; i += 1) {
      if (i % 2 === 0) {
        if (can(policy, subject, permission).allowed) allowedCount += 1;
      } else if (checkLimit(policy, subject, limit, i % 64).allowed) {
        allowedCount += 1;
      }
    }
    const elapsedMs = performance.now() - start;

    expect(allowedCount).toBeGreaterThan(0);
    expect(can(policy, subject, permission).allowed).toBe(true);
    expect(checkLimit(policy, subject, limit, 49)).toEqual({
      allowed: false,
      limit: 49,
      remaining: 0,
    });
    expect(elapsedMs).toBeLessThan(500);
  });
});
