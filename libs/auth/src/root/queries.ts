import { ownDevices } from '../use-cases/hydrate-own-devices/shared/own-devices-query';
import { ownExternalAccounts } from '../use-cases/hydrate-own-external-accounts/shared/own-external-accounts-query';
import { ownUser } from '../use-cases/hydrate-own-user/shared/own-user-query';

export const AUTH_QUERIES = [ownUser, ownDevices, ownExternalAccounts] as const;
