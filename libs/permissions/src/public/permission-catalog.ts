/**
 * What callers gate on: catalogued actions, permissions and limits. Roles,
 * plans and the facts behind them are not here — nothing outside this
 * package can name one, so nothing outside it can branch on one.
 */
export {
  ACTION,
  type AppAction,
  type AppGrantKey,
  type AppLimit,
  type AppPermission,
  type AppPolicyKey,
  type AppQuota,
  isQuotaAction,
  LIMIT,
  PERMISSION,
  QUOTA_ACTIONS,
  type SpacePresenceRole,
} from '../shared/permission-catalog';
