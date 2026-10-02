import { confirmAccountDeletionMutation } from '../use-cases/confirm-account-deletion/shared/confirm-account-deletion-mutation';
import { requestPersonalDataExportMutation } from '../use-cases/request-personal-data-export/shared/request-personal-data-export-mutation';

export const ACCOUNT_PRIVACY_MUTATIONS = [confirmAccountDeletionMutation, requestPersonalDataExportMutation] as const;
