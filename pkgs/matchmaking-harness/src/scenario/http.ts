import type { MiddlewareHandler } from 'hono';

/** Header the harness HTTP app treats as a bearer. */
export const HARNESS_AUTH_HEADER = 'x-test-user';

export const HARNESS_AUTH_HEADERS = {
  [HARNESS_AUTH_HEADER]: 'tester',
} as const;

/** Stub auth middleware wired into every `httpRequest` action app. */
export const harnessRequireAuth: MiddlewareHandler = async (c, next) => {
  if (c.req.header(HARNESS_AUTH_HEADER) === undefined) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  return await next();
};
