import { ownAccountDevices } from './own-account-devices-query';
import { ownDevices } from './own-devices-query';
import { ownExternalAccounts } from './own-external-accounts-query';
import { ownUser } from './own-user-query';

export const AUTH_QUERIES = [
  ownUser,
  ownDevices,
  ownAccountDevices,
  ownExternalAccounts,
] as const;
