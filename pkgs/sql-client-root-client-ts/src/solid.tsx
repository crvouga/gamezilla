/** @jsxImportSource @solidjs/web */
import { defineContext } from '@pkgs/solid-context-client-ts/define-context';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import type { JSX } from '@solidjs/web';
import type { ParentProps } from 'solid-js';

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
