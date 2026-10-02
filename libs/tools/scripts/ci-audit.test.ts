import { expect, test } from 'bun:test';
import { auditVerdict } from './ci-audit';

test('audit preserves fresh registry failure, including the literal high dicer advisory', () => {
  const snapshot = {
    version: 1 as const,
    status: 1,
    advisories: {
      dicer: [
        {
          id: 1093150,
          severity: 'high',
          url: 'https://github.com/advisories/GHSA-wm7h-9275-46v2',
        },
      ],
    },
  };
  expect(auditVerdict(JSON.stringify(snapshot))).toEqual(snapshot);
  expect(auditVerdict(JSON.stringify({ ...snapshot, status: 0 })).status).toBe(
    0
  );
  expect(() =>
    auditVerdict(JSON.stringify({ ...snapshot, version: 2 }))
  ).toThrow();
  expect(() =>
    auditVerdict(JSON.stringify({ ...snapshot, status: null }))
  ).toThrow();
});
