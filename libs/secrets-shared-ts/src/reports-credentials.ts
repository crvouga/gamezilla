/**
 * Optional credentials for an externally configured spec reports store.
 * Standalone Atlas tooling reads; verification publishes with the write pair.
 * OpenTofu does not provision a reports bucket or these credentials.
 */

import { requireHttpsUrl, requireNonEmpty, Secret } from './secret';

export const REPORTS_BUCKET = new Secret({
  name: 'REPORTS_BUCKET',
  hint: 'The optional shared spec reports bucket',
  validate: async (input) => {
    requireNonEmpty(input.secretValue, 'REPORTS_BUCKET');
  },
  optional: true,
});

export const REPORTS_ENDPOINT = new Secret({
  name: 'REPORTS_ENDPOINT',
  hint: 'S3 API endpoint of the reports bucket, e.g. https://<accountid>.r2.cloudflarestorage.com',
  validate: async (input) => {
    requireHttpsUrl(input.secretValue, 'REPORTS_ENDPOINT');
  },
  optional: true,
});

export const REPORTS_ACCESS_KEY_ID = new Secret({
  name: 'REPORTS_ACCESS_KEY_ID',
  hint: 'Read-only S3 access key id (R2 API token id) for the reports bucket',
  validate: async (input) => {
    requireNonEmpty(input.secretValue, 'REPORTS_ACCESS_KEY_ID');
  },
  optional: true,
});

export const REPORTS_SECRET_ACCESS_KEY = new Secret({
  name: 'REPORTS_SECRET_ACCESS_KEY',
  hint: 'Read-only S3 secret key (SHA-256 of the R2 API token value)',
  validate: async (input) => {
    requireNonEmpty(input.secretValue, 'REPORTS_SECRET_ACCESS_KEY');
  },
  optional: true,
});

export const REPORTS_WRITE_ACCESS_KEY_ID = new Secret({
  name: 'REPORTS_WRITE_ACCESS_KEY_ID',
  hint: 'Write S3 access key id for the reports bucket (CI publishing only)',
  validate: async (input) => {
    requireNonEmpty(input.secretValue, 'REPORTS_WRITE_ACCESS_KEY_ID');
  },
  optional: true,
});

export const REPORTS_WRITE_SECRET_ACCESS_KEY = new Secret({
  name: 'REPORTS_WRITE_SECRET_ACCESS_KEY',
  hint: 'Write S3 secret key for the reports bucket (CI publishing only)',
  validate: async (input) => {
    requireNonEmpty(input.secretValue, 'REPORTS_WRITE_SECRET_ACCESS_KEY');
  },
  optional: true,
});

export const REPORTS_SECRETS: readonly Secret[] = [
  REPORTS_BUCKET,
  REPORTS_ENDPOINT,
  REPORTS_ACCESS_KEY_ID,
  REPORTS_SECRET_ACCESS_KEY,
  REPORTS_WRITE_ACCESS_KEY_ID,
  REPORTS_WRITE_SECRET_ACCESS_KEY,
];
