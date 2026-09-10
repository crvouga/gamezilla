/**
 * Hook-only entry for mutate() call sites. Do not import
 * `@libs/auth/public/mutation-client-provider` from route graphs — that module
 * pulls `createMutationClient` / SQL AST (`node-sql-parser`) into the chunk.
 */
export { useMutationClient } from '@pkgs/sync-engine/solid/mutation-client';
