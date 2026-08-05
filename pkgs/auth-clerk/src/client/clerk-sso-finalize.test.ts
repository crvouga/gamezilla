import { describe, expect, test } from 'bun:test';

import {
  readCompletedSessionId,
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

  test('readCompletedSessionId falls back to existingSession', () => {
    const result: SsoFlowResult = {
      createdSessionId: null,
      signIn: {
        status: 'complete',
        existingSession: { sessionId: 'sess_a' },
      },
    };
    expect(readCompletedSessionId(result)).toBe('sess_a');
  });
});
