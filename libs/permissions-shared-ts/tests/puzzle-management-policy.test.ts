import { expect, test } from 'bun:test';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { permissionPolicyForPuzzleManagers } from '@libs/permissions-shared-ts/permission-policy';
import { decide } from '@pkgs/permissions-shared-ts/decision';
import { resolveSubject } from '@pkgs/permissions-shared-ts/resolve';

function mayManage(accountId: string | null, allowlist: readonly string[]) {
  const policy = permissionPolicyForPuzzleManagers(allowlist);
  const subject = resolveSubject(policy, {
    auth: accountId === null ? 'anonymous' : 'verified',
    accountId,
    membership: 'none',
    subscription: 'none',
    billing: 'off',
  });
  return decide(policy, subject, PERMISSION.puzzlesManage).allowed;
}

test('each environment grants puzzle management only to its configured accounts', () => {
  expect(mayManage('dev-manager', ['dev-manager'])).toBe(true);
  expect(mayManage('production-manager', ['dev-manager'])).toBe(false);
  expect(mayManage(null, ['dev-manager'])).toBe(false);
  expect(mayManage('dev-manager', [])).toBe(false);
});
