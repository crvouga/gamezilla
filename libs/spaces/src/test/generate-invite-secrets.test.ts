import { describe, expect, test } from 'bun:test';

import { generateInviteToken } from '../shared/generate-invite-secrets';

describe('generateInviteSecrets', () => {
  test('token is long hex', () => {
    const token = generateInviteToken();
    expect(token.length).toBe(48);
    expect(/^[0-9a-f]+$/.test(token)).toBe(true);
  });
});
