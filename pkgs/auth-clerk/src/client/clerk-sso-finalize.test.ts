import { describe, expect, test } from 'bun:test';

import {
  readCompletedSessionId,
  readNewSessionIdFromSsoResult,
  type SsoFlowResult,
} from './clerk-sso-finalize';

describe('clerk-sso-finalize', () => {
  test('readCompletedSessionId prefers createdSessionId', () => {
    const result: SsoFlowResult = {
      createdSessionId: 'sess_new',
      signIn: { existingSession: { sessionId: 'sess_old' } },
    };
    expect(readCompletedSessionId(result)).toBe('sess_new');
  });

  test('readNewSessionIdFromSsoResult ignores sessions already on device', () => {
    const result: SsoFlowResult = {
      createdSessionId: null,
      signIn: {
        status: 'complete',
        existingSession: { sessionId: 'sess_a' },
      },
    };
    expect(
      readNewSessionIdFromSsoResult(result, new Set(['sess_a']))
    ).toBeNull();
  });

  test('readNewSessionIdFromSsoResult returns a newly created session', () => {
    const result: SsoFlowResult = {
      createdSessionId: 'sess_b',
      signIn: { status: 'complete', createdSessionId: 'sess_b' },
    };
    expect(
      readNewSessionIdFromSsoResult(result, new Set(['sess_a']))
    ).toBe('sess_b');
  });
});
