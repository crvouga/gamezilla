/**
 * Credentials for the one spec reports bucket every environment shares
 * (`libs/infra-shared/tofu/modules/report-access`). The read pair goes to the API
 * Worker, which serves `/api/reports`; the write pair stays in the secrets
 * store for the Check workflow's `report-publish.ts`.
 */

import { requireHttpsUrl, requireNonEmpty, Secret } from './secret';

export const REPORTS_BUCKET = new Secret({
  name: 'REPORTS_BUCKET',
  hint: 'The shared spec reports bucket (global.tfvars.json `reports.bucket`)',
  pushToApiWorker: true,
  validate: async (input) => {
    requireNonEmpty(input.secretValue, 'REPORTS_BUCKET');
  },
  managedBy: 'tofu',
});

export const REPORTS_ENDPOINT = new Secret({
  name: 'REPORTS_ENDPOINT',
  hint: 'S3 API endpoint of the reports bucket, e.g. https://<accountid>.r2.cloudflarestorage.com',
  pushToApiWorker: true,
  validate: async (input) => {
    requireHttpsUrl(input.secretValue, 'REPORTS_ENDPOINT');
  },
  managedBy: 'tofu',
});

export const REPORTS_ACCESS_KEY_ID = new Secret({
  name: 'REPORTS_ACCESS_KEY_ID',
  hint: 'Read-only S3 access key id (R2 API token id) for the reports bucket',
  pushToApiWorker: true,
  validate: async (input) => {
    requireNonEmpty(input.secretValue, 'REPORTS_ACCESS_KEY_ID');
  },
  managedBy: 'tofu',
});

export const REPORTS_SECRET_ACCESS_KEY = new Secret({
  name: 'REPORTS_SECRET_ACCESS_KEY',
  hint: 'Read-only S3 secret key (SHA-256 of the R2 API token value)',
  pushToApiWorker: true,
  validate: async (input) => {
    requireNonEmpty(input.secretValue, 'REPORTS_SECRET_ACCESS_KEY');
  },
  managedBy: 'tofu',
});

export const REPORTS_WRITE_ACCESS_KEY_ID = new Secret({
  name: 'REPORTS_WRITE_ACCESS_KEY_ID',
  hint: 'Write S3 access key id for the reports bucket (CI publishing only)',
  validate: async (input) => {
    requireNonEmpty(input.secretValue, 'REPORTS_WRITE_ACCESS_KEY_ID');
  },
  managedBy: 'tofu',
});

export const REPORTS_WRITE_SECRET_ACCESS_KEY = new Secret({
  name: 'REPORTS_WRITE_SECRET_ACCESS_KEY',
  hint: 'Write S3 secret key for the reports bucket (CI publishing only)',
  validate: async (input) => {
    requireNonEmpty(input.secretValue, 'REPORTS_WRITE_SECRET_ACCESS_KEY');
  },
  managedBy: 'tofu',
});

export const REPORTS_SECRETS: readonly Secret[] = [
  REPORTS_BUCKET,
  REPORTS_ENDPOINT,
  REPORTS_ACCESS_KEY_ID,
  REPORTS_SECRET_ACCESS_KEY,
  REPORTS_WRITE_ACCESS_KEY_ID,
  REPORTS_WRITE_SECRET_ACCESS_KEY,
];
