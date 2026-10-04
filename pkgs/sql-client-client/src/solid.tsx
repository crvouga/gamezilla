/** @jsxImportSource solid-js */
import { defineContext } from '@pkgs/solid-context-client/define-context';
import type { JSX, ParentProps } from 'solid-js';

import type { SqlClient } from '@pkgs/sql-client-shared/interface';

const SqlClientContext = defineContext<SqlClient>('SqlClient');

export type SqlClientProviderProps = ParentProps<{
  readonly value: SqlClient;
}>;

/** Mounts the local {@link SqlClient} for the Solid tree. */
export const SqlClientProvider: (props: SqlClientProviderProps) => JSX.Element =
  SqlClientContext.Provider;

export function useSqlClient(): SqlClient {
  return SqlClientContext.use();
}
