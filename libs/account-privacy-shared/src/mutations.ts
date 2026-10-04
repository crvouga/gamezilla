import { confirmAccountDeletionMutation } from './confirm-account-deletion-mutation';
import { requestPersonalDataExportMutation } from './request-personal-data-export-mutation';

export const ACCOUNT_PRIVACY_MUTATIONS = [
  confirmAccountDeletionMutation,
  requestPersonalDataExportMutation,
] as const;
