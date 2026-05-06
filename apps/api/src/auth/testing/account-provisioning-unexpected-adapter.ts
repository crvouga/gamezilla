import type { AccountProvisioningPort } from '../ports';

export class AccountProvisioningUnexpectedAdapter implements AccountProvisioningPort {
  async resolveInternalAccountId(): Promise<string> {
    throw new Error('should not run');
  }
}

