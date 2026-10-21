import { ROLE } from './permission-catalog';
import { type AccessReader, readPermissionPolicy } from './read-access';

/** The deployment's explicitly configured puzzle-management recipients. */
export async function puzzleManagementAudience(
  db: AccessReader
): Promise<readonly string[]> {
  const policy = await readPermissionPolicy(db);
  const predicate = policy.roles[ROLE.puzzleManager]?.when;
  if (
    typeof predicate !== 'object' ||
    predicate === null ||
    !('accountId' in predicate)
  )
    return [];
  const ids = predicate['accountId'];
  if (!Array.isArray(ids)) return [];
  return [
    ...new Set(ids.filter((id): id is string => typeof id === 'string')),
  ].sort();
}
