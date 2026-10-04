import { createMessageNamespace, isPlainRecord } from '@pkgs/message-shared/message';

export type PrivacyAccount = { readonly accountId: string };
const namespace = createMessageNamespace('profile', 'privacy');
const isAccount = (value: unknown): value is PrivacyAccount =>
  isPlainRecord(value) &&
  typeof value['accountId'] === 'string' &&
  value['accountId'].length > 0;

export const prepareExport = namespace('prepare-export', isAccount);
export const eraseAccount = namespace('erase-account', isAccount);
export const withdrawAccount = namespace('withdraw-account', isAccount);
export const expireExport = namespace('expire-export', isAccount);
