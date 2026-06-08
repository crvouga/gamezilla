import { describe, expect, test } from 'bun:test';
import { isApiRequestPath } from './is-api-request-path';

describe('isApiRequestPath', () => {
  test('matches API routes', () => {
    expect(isApiRequestPath('/health')).toBe(true);
    expect(isApiRequestPath('/api/auth/sign-in')).toBe(true);
    expect(isApiRequestPath('/auth/refresh')).toBe(true);
    expect(isApiRequestPath('/patch-db/sync')).toBe(true);
    expect(isApiRequestPath('/room')).toBe(true);
    expect(isApiRequestPath('/matchmaking/join')).toBe(true);
    expect(isApiRequestPath('/stripe/webhook')).toBe(true);
    expect(isApiRequestPath('/client-config/refresh')).toBe(true);
    expect(isApiRequestPath('/llm/structured')).toBe(true);
    expect(isApiRequestPath('/tts/synthesize')).toBe(true);
  });

  test('does not match static web routes', () => {
    expect(isApiRequestPath('/')).toBe(false);
    expect(isApiRequestPath('/index.html')).toBe(false);
    expect(isApiRequestPath('/assets/app.js')).toBe(false);
    expect(isApiRequestPath('/space/abc')).toBe(false);
  });
});
