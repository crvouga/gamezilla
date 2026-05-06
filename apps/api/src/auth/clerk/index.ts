import type { HttpBearerAuthPorts } from '../ports';
import { clerkAccountProvisioning } from './account-provisioning';
import { createClerkSessionClaimsPort } from './session-claims-port';

export { clerkAccountProvisioning } from './account-provisioning';
export { createClerkSessionClaimsPort } from './session-claims-port';

export function createClerkHttpBearerAuthPorts(
  secretKey: string
): HttpBearerAuthPorts {
  return {
    sessionClaims: createClerkSessionClaimsPort(secretKey),
    accountProvisioning: clerkAccountProvisioning,
  };
}
