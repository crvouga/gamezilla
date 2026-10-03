import type { HarnessSlice } from '@libs/harness/slices';
import { ACCOUNT_PRIVACY_CLIENT } from '../root/client/feature-client';
import { ACCOUNT_PRIVACY_FEATURE } from '../root/feature';
import { createAccountPrivacyServer } from '../root/server/feature-server';
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
  feature: ACCOUNT_PRIVACY_FEATURE,
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
