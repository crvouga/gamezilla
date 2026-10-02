import { defineFeature } from '@libs/feature/public/manifest';
import { ACCOUNT_PRIVACY_TABLES } from '../public/schema';
import { ownAccountPrivacy } from '../use-cases/hydrate-account-privacy/shared/account-privacy-query';
import { downloadPersonalDataExport } from '../use-cases/download-personal-data-export/shared/download-personal-data-export-query';
import { accountPrivacyGuard } from './account-privacy-guard';
import { ACCOUNT_PRIVACY_TOPIC_MAP } from '../public/topic-map';
import { deletionReceipts } from '../use-cases/hydrate-account-privacy/shared/deletion-receipts-query';

export const ACCOUNT_PRIVACY_FEATURE = defineFeature({
  name: 'account-privacy',
  tables: ACCOUNT_PRIVACY_TABLES,
  topicMap: ACCOUNT_PRIVACY_TOPIC_MAP,
  accountPrivacyGuard,
  readsForeign: ['auth_account_devices'],
  queries: [ownAccountPrivacy, downloadPersonalDataExport, deletionReceipts],
  sessionQueries: ['ownAccountPrivacy', 'deletionReceipts'],
  mutations: async () => (await import('./mutations')).ACCOUNT_PRIVACY_MUTATIONS,
});
