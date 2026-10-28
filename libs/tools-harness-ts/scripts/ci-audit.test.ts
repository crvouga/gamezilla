import { expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ADVISORIES_ENV,
  type AuditSnapshot,
  advisoryMode,
  recordVerdict,
} from './audit-snapshot';
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

const failing: AuditSnapshot = {
  version: 1,
  status: 1,
  advisories: { vite: [{ id: 1, severity: 'high' }] },
};

test('a pull request enforces current advisories; Release reports them without failing', () => {
  expect(advisoryMode({})).toBe('enforce');
  expect(advisoryMode({ [ADVISORIES_ENV]: 'enforce' })).toBe('enforce');
  expect(advisoryMode({ [ADVISORIES_ENV]: 'report' })).toBe('report');
  expect(() => advisoryMode({ [ADVISORIES_ENV]: 'off' })).toThrow();
  expect(recordVerdict(failing, 'enforce')).toEqual(failing);
  expect(recordVerdict(failing, 'report')).toEqual({
    ...failing,
    status: 0,
    reported: 1,
  });
  const clean = { ...failing, status: 0 };
  expect(recordVerdict(clean, 'report')).toEqual(clean);
});

test('the recorded report keeps the advisories and passes the pure gate', () => {
  const recorded = recordVerdict(failing, 'report');
  expect(auditVerdict(JSON.stringify(recorded))).toEqual(recorded);
  expect(auditVerdict(JSON.stringify(recorded)).status).toBe(0);
  expect(() =>
    auditVerdict(JSON.stringify({ ...recorded, reported: 'high' }))
  ).toThrow();
});

test('only Release asks for report; the pull request workflow defaults to enforce', () => {
  const workflows = join(import.meta.dirname, '../../../.github/workflows');
  const verify = readFileSync(join(workflows, 'verify-pr.yml'), 'utf8');
  expect(verify).toContain(
    "VERIFY_ADVISORIES: ${{ inputs.advisories || 'enforce' }}"
  );
  for (const name of readdirSync(workflows)) {
    const text = readFileSync(join(workflows, name), 'utf8');
    expect(/advisories: report/.test(text)).toBe(name === 'deploy.yml');
  }
});
