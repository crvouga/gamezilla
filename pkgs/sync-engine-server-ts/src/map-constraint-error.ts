import type { MutationFailure } from '@pkgs/sync-engine-shared-ts/mutations-types';

export type ConstraintErrorMap = Readonly<
  Record<string, { readonly code: string; readonly message: string }>
>;

/**
 * Map a Postgres unique-violation (23505) to a business rejection via the
 * mutation's constraintErrors keyed by constraint/index name.
 */
export function mapConstraintError(
  e: unknown,
  constraintErrors: ConstraintErrorMap | undefined
): MutationFailure | undefined {
  if (constraintErrors === undefined) return undefined;
  const info = readPgConstraint(e);
  if (info === undefined) return undefined;
  const mapped = constraintErrors[info.constraint];
  if (mapped === undefined) return undefined;
  return {
    rule: info.constraint,
    code: mapped.code,
    message: mapped.message,
  };
}

type PgConstraintInfo = {
  readonly code: string;
  readonly constraint: string;
};

function readPgConstraint(e: unknown): PgConstraintInfo | undefined {
  if (e === null || typeof e !== 'object') return undefined;
  const record = e as Record<string, unknown>;
  const code =
    typeof record['errno'] === 'string'
      ? record['errno']
      : typeof record['code'] === 'string'
        ? record['code']
        : undefined;
  if (code !== '23505') return undefined;
  const constraint =
    typeof record['constraint'] === 'string'
      ? record['constraint']
      : typeof record['constraint_name'] === 'string'
        ? record['constraint_name']
        : undefined;
  if (constraint === undefined || constraint.length === 0) return undefined;
  return { code, constraint };
}
