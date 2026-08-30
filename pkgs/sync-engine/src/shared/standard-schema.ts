import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { MutationFailure } from '../mutations/core/types';

export type ParseOk<T> = { readonly ok: true; readonly value: T };
export type ParseFail = {
  readonly ok: false;
  readonly issues: readonly StandardSchemaV1.Issue[];
};
export type ParseResult<T> = ParseOk<T> | ParseFail;

/**
 * Validate `value` against any Standard Schema V1 schema.
 * Spec allows sync or async validate — always await.
 */
export async function parseStandardSchema<T>(
  schema: StandardSchemaV1<unknown, T>,
  value: unknown
): Promise<ParseResult<T>> {
  let result = schema['~standard'].validate(value);
  if (result instanceof Promise) {
    result = await result;
  }
  if (result.issues) {
    return { ok: false, issues: result.issues };
  }
  return { ok: true, value: result.value };
}

/** Map Standard Schema issues to mutation INVALID_ARGS failures. */
export function schemaIssuesToFailures(
  issues: readonly StandardSchemaV1.Issue[],
  mutationName: string
): MutationFailure[] {
  return issues.map((issue) => ({
    rule: mutationName,
    code: 'INVALID_ARGS',
    message: issue.message,
    ...(issue.path !== undefined ? { meta: { path: issue.path } } : {}),
  }));
}

/** Empty-object schema used when a query omits `params`. */
export const emptyObjectSchema: StandardSchemaV1<
  Record<string, never>,
  Record<string, never>
> = {
  '~standard': {
    version: 1,
    vendor: 'sync-engine',
    validate(value) {
      if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        Object.keys(value as object).length === 0
      ) {
        return { value: value as Record<string, never> };
      }
      // Accept missing / undefined / any plain object for empty default —
      // query wire often sends `{}` or omits fields.
      if (
        value === undefined ||
        value === null ||
        (typeof value === 'object' && !Array.isArray(value))
      ) {
        return { value: {} as Record<string, never> };
      }
      return {
        issues: [{ message: 'Expected an object' }],
      };
    },
  },
};

/** Fixed stub params for CI / boot topic checks (no Zod introspection). */
export const QUERY_PARAM_STUB: Readonly<Record<string, unknown>> = {
  spaceId: 'space_x',
  userId: 'user_x',
  folderId: 'folder_x',
  ids: ['id_x'],
  username: 'user_x',
  rejectionId: 'rejection_x',
};
