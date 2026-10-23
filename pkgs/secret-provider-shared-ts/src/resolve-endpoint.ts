import type { ResolvedSecretsScope } from '@pkgs/secrets-config-shared-ts/defaults';
import { INFISICAL_DEFAULT_ENDPOINT } from './defaults';

export function resolveInfisicalEndpoint(
  scope: Pick<ResolvedSecretsScope, 'endpoint'>
): string {
  const fromScope = scope.endpoint?.trim() ?? '';
  if (fromScope.length > 0) return fromScope.replace(/\/+$/, '');
  return INFISICAL_DEFAULT_ENDPOINT;
}
