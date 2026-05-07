import type { JoinConfig } from '@better-auth/core/db/adapter';
import { BetterAuthError } from '@better-auth/core/error';

export function assertNoJoin(
  join: JoinConfig | undefined,
  method: string
): void {
  if (join && Object.keys(join).length > 0) {
    throw new BetterAuthError(
      `[SqlClient Better Auth adapter] ${method}: database joins are not supported by this adapter.`
    );
  }
}
