import { ACCOUNT_PRIVACY_CLIENT } from '@libs/account-privacy-client/sub-client';
import { createAccountPrivacyServer } from '@libs/account-privacy-server/sub-server';
import { ACCOUNT_PRIVACY_SUB } from '@libs/account-privacy-shared/sub';
import type { HarnessSlice } from '@libs/harness/slices';
import {
  askForExport,
  cancelDeletion,
  completeExport,
  confirmDeletion,
  openExportAddress,
  openPrivacy,
  privacyTimePasses,
  proveAccount,
  reviewDeletion,
  runPrivacyJobs,
} from './privacy-actions';
import {
  preserveProfileForLegalObligation,
  releaseLegalObligation,
} from './retention';

export const ACCOUNT_PRIVACY_HARNESS_SLICE: HarnessSlice = {
  name: 'account-privacy',
  sub: ACCOUNT_PRIVACY_SUB,
  client: ACCOUNT_PRIVACY_CLIENT,
  actions: [
    preserveProfileForLegalObligation,
    releaseLegalObligation,
    askForExport,
    cancelDeletion,
    confirmDeletion,
    openPrivacy,
    proveAccount,
    reviewDeletion,
    runPrivacyJobs,
    privacyTimePasses,
    completeExport,
    openExportAddress,
  ],
  server: (deps) =>
    createAccountPrivacyServer(deps.app.accountPrivacy, deps.rooms),
};
