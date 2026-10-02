import { expect, test } from 'bun:test';
import { GLOBAL } from '@libs/infra/public/global';

test('the transferred repository supplies its current OIDC subject and audience', () => {
  // regression: ci-repository-transfer-oidc-subject
  expect(`repo:${GLOBAL.github.owner}/${GLOBAL.github.repo}:pull_request`).toBe(
    'repo:gamezilla-org/gamezilla:pull_request'
  );
  expect(`https://github.com/${GLOBAL.github.owner}`).toBe(
    'https://github.com/gamezilla-org'
  );
});
