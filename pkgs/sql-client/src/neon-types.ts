/** Re-exports Neon serverless driver types for consumers outside `@pkgs/sql-client`. */
export type {
  Client as NeonWsClient,
  QueryResultRow as NeonQueryResultRow,
} from '@neondatabase/serverless';
