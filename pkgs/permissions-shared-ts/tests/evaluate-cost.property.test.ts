import { describe, expect, test } from 'bun:test';
import { can, checkLimit } from '@pkgs/permissions-shared-ts/evaluate';
import { definePolicy } from '@pkgs/permissions-shared-ts/policy';
import { createSubject } from '@pkgs/permissions-shared-ts/subject';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

type Role = {
  readonly grants: string[];
  readonly permissions: string[];
  readonly limits: Record<string, number>;
};

/**
 * Work is counted, not timed: every role record the evaluator reads, and
 * every enumeration of the role table, goes through this proxy. A wall-clock
 * bar would make the verdict depend on machine load; a count is a function of
 * the code alone.
 */
function countingRoles(roles: Record<string, Role>) {
  const counts = { reads: 0, scans: 0 };
  const proxy = new Proxy(roles, {
    get(target, key, receiver) {
      if (typeof key === 'string' && key in target) counts.reads += 1;
      return Reflect.get(target, key, receiver);
    },
    ownKeys(target) {
      counts.scans += 1;
      return Reflect.ownKeys(target);
    },
  });
  return { proxy, counts };
}

function role(index: number): Role {
  return {
    grants: [],
    permissions: [`permission:${String(index)}`],
    limits: { [`limit:${String(index)}`]: index + 1 },
  };
}

/** Cost of one `can` + one `checkLimit`, on a fresh policy of `size` roles. */
function costOfChecks(size: number, held: readonly number[], probe: number) {
  const { proxy, counts } = countingRoles(
    Object.fromEntries(
      Array.from({ length: size }, (_, i) => [`role-${String(i)}`, role(i)])
    )
  );
  const policy = definePolicy({ roles: proxy });
  const subject = createSubject(held.map((i) => `role-${String(i)}`));
  const decision = can(policy, subject, `permission:${String(probe)}`);
  const verdict = checkLimit(policy, subject, `limit:${String(probe)}`, 0);
  expect(decision).not.toBeInstanceOf(Promise);
  expect(verdict).not.toBeInstanceOf(Promise);
  expect(decision.allowed).toBe(held.includes(probe));
  return { ...counts };
}

describe('permission evaluation cost', () => {
  test('property: a check reads only the roles the subject holds, whatever the policy size', () => {
    assertProperty(
      'cost independent of policy size',
      fc.property(
        fc.uniqueArray(fc.nat({ max: 7 }), { minLength: 1, maxLength: 4 }),
        fc.nat({ max: 7 }),
        fc.integer({ min: 8, max: 512 }),
        (held, probe, extra) => {
          const small = costOfChecks(8, held, probe);
          const large = costOfChecks(8 + extra, held, probe);
          expect(large).toEqual(small);
          expect(small.reads).toBeGreaterThan(0);
          expect(small.scans).toBe(0);
        }
      )
    );
  });
});
