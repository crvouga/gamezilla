import { defineFeature } from '@libs/feature/public/manifest';
import { ACCOUNT_PRIVACY_TABLES } from '../public/schema';
import { ACCOUNT_PRIVACY_TOPIC_MAP } from '../public/topic-map';
import { downloadPersonalDataExport } from '../use-cases/download-personal-data-export/shared/download-personal-data-export-query';
import { ownAccountPrivacy } from '../use-cases/hydrate-account-privacy/shared/account-privacy-query';
import { deletionReceipts } from '../use-cases/hydrate-account-privacy/shared/deletion-receipts-query';
import { accountPrivacyGuard } from './account-privacy-guard';

export const ACCOUNT_PRIVACY_FEATURE = defineFeature({
  name: 'account-privacy',
  tables: ACCOUNT_PRIVACY_TABLES,
  topicMap: ACCOUNT_PRIVACY_TOPIC_MAP,
  accountPrivacyGuard,
  readsForeign: ['auth_account_devices'],
  queries: [ownAccountPrivacy, downloadPersonalDataExport, deletionReceipts],
  sessionQueries: ['ownAccountPrivacy', 'deletionReceipts'],
  mutations: async () =>
    (await import('./mutations')).ACCOUNT_PRIVACY_MUTATIONS,
});
