import { describe, expect, test } from 'bun:test';
import { isApiRequestPath } from './is-api-request-path';

describe('isApiRequestPath', () => {
  test('matches API routes under /api', () => {
    expect(isApiRequestPath('/api/health')).toBe(true);
    expect(isApiRequestPath('/api/auth/sign-in')).toBe(true);
    expect(isApiRequestPath('/api/identity/refresh')).toBe(true);
    expect(isApiRequestPath('/api/query')).toBe(true);
    expect(isApiRequestPath('/api/mutations')).toBe(true);
    expect(isApiRequestPath('/api/room')).toBe(true);
    expect(isApiRequestPath('/api/matchmaking/join')).toBe(true);
    expect(isApiRequestPath('/api/stripe/checkout')).toBe(true);
    expect(isApiRequestPath('/api/client-config/refresh')).toBe(true);
    expect(isApiRequestPath('/api/llm/structured')).toBe(true);
    expect(isApiRequestPath('/api/tts/synthesize')).toBe(true);
  });

  test('does not match static web routes', () => {
    expect(isApiRequestPath('/')).toBe(false);
    expect(isApiRequestPath('/index.html')).toBe(false);
    expect(isApiRequestPath('/assets/app.js')).toBe(false);
    expect(isApiRequestPath('/space/abc')).toBe(false);
  });
});
