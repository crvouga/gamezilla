import { defineFeature } from '@libs/feature-shared/manifest';
import { accountPrivacyGuard } from './account-privacy-guard';
import { ownAccountPrivacy } from './account-privacy-query';
import { deletionReceipts } from './deletion-receipts-query';
import { downloadPersonalDataExport } from './download-personal-data-export-query';
import { ACCOUNT_PRIVACY_MUTATIONS } from './mutations';
import { ACCOUNT_PRIVACY_TABLES } from './tables';
import { ACCOUNT_PRIVACY_TOPIC_MAP } from './topic-map';

export const ACCOUNT_PRIVACY_FEATURE = defineFeature({
  name: 'account-privacy',
  tables: ACCOUNT_PRIVACY_TABLES,
  topicMap: ACCOUNT_PRIVACY_TOPIC_MAP,
  accountPrivacyGuard,
  readsForeign: ['auth_account_devices'],
  queries: [ownAccountPrivacy, downloadPersonalDataExport, deletionReceipts],
  sessionQueries: ['ownAccountPrivacy', 'deletionReceipts'],
  mutations: async () => ACCOUNT_PRIVACY_MUTATIONS,
});
