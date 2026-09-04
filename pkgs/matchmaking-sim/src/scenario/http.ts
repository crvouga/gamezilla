import type { MiddlewareHandler } from 'hono';

/** Header the sim HTTP app treats as a bearer. */
export const SIM_AUTH_HEADER = 'x-test-user';

export const SIM_AUTH_HEADERS = { [SIM_AUTH_HEADER]: 'tester' } as const;

/** Stub auth middleware wired into every `httpRequest` action app. */
export const simRequireAuth: MiddlewareHandler = async (c, next) => {
  if (c.req.header(SIM_AUTH_HEADER) === undefined) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  return await next();
};
