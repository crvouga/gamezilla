import type { Context } from 'hono';

import { runWrite } from '../shared/run-write';
import type { WriteRegistry } from '../shared/write-registry';
import { isWriteFailure } from '../shared/write-result';
import type { WriteContext } from '../shared/write-context';
import type { WriteStore } from '../shared/write-store';

const DEFAULT_STATUS_BY_CODE: Readonly<Record<string, number>> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
};

export type CreateWriteRouteOptions<TAuth> = {
  readonly resolveAuth: (c: Context) => Promise<TAuth | null>;
  readonly mapAuth: (auth: TAuth) => WriteContext;
  readonly openStore: () => Promise<WriteStore>;
  readonly statusByCode?: Readonly<Record<string, number>>;
};

function resolveStatus(
  code: string,
  statusByCode: Readonly<Record<string, number>>
): number {
  const exact = statusByCode[code];
  if (exact !== undefined) {
    return exact;
  }
  for (const [prefix, status] of Object.entries(statusByCode)) {
    if (code.startsWith(prefix)) {
      return status;
    }
  }
  return 400;
}

export function createWriteRouteHandler<TAuth>(
  registry: WriteRegistry,
  options: CreateWriteRouteOptions<TAuth>
): (c: Context) => Promise<Response> {
  const statusByCode = {
    ...DEFAULT_STATUS_BY_CODE,
    ...options.statusByCode,
  };

  return async (c) => {
    const auth = await options.resolveAuth(c);
    if (auth === null) {
      return c.json({ ok: false, code: 'UNAUTHORIZED', message: 'unauthorized' }, 401);
    }
    const writeName = c.req.param('name');
    if (writeName === undefined || writeName.length === 0) {
      return c.json(
        { ok: false, code: 'WRITE_NOT_FOUND', message: 'write name required' },
        404
      );
    }
    const write = registry.get(writeName);
    if (write === undefined) {
      return c.json(
        { ok: false, code: 'WRITE_NOT_FOUND', message: `unknown write ${writeName}` },
        404
      );
    }
    const body = await c.req.json().catch(() => null);
    const store = await options.openStore();
    const result = await runWrite({
      write,
      ctx: options.mapAuth(auth),
      rawInput: body,
      store,
      mode: 'full',
    });
    if (isWriteFailure(result)) {
      const statusCode = resolveStatus(result.code, statusByCode);
      return c.json(
        {
          ok: false,
          code: result.code,
          message: result.message,
          ...(result.meta !== undefined ? { meta: result.meta } : {}),
        },
        statusCode as 400
      );
    }
    return c.json({ ok: true, value: result.value }, 200);
  };
}
