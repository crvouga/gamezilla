import { initGraphQLTada } from 'gql.tada';
import type { introspection } from './graphql-env';

export const graphql = initGraphQLTada<{
  introspection: introspection;
}>();

export type { ResultOf, VariablesOf } from 'gql.tada';
