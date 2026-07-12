import { ApiWorkerResource } from './api-worker';
import { ClientWorkerResource } from './client-worker';
import { S3BucketResource } from './s3-bucket';
import { ClientRedirectRuleResource } from './client-redirect-rule';
import { DnsRecordsResource } from './dns-records';
import { PostgresResource } from './postgres';
import { PowerSyncResource } from './powersync';
import { SecretsResource } from './secrets';
import type { Resource } from './types';
import { ZoneResource } from './zone';

export function createRegistry(): readonly Resource[] {
  const secrets = new SecretsResource();
  const zone = new ZoneResource();
  const postgres = new PostgresResource();
  const powerSync = new PowerSyncResource();
  const s3Bucket = new S3BucketResource();
  const dnsRecords = new DnsRecordsResource();
  const clientRedirectRule = new ClientRedirectRuleResource();
  const apiWorker = new ApiWorkerResource();
  const clientWorker = new ClientWorkerResource();

  zone.needs(secrets);
  postgres.needs(secrets);
  powerSync.needs(secrets, postgres);
  s3Bucket.needs(secrets);
  dnsRecords.needs(zone);
  clientRedirectRule.needs(zone);
  // API first so www/apex custom domains detach before the assets-only Worker
  // claims them.
  apiWorker.needs(postgres, dnsRecords, s3Bucket);
  clientWorker.needs(apiWorker);

  return [
    secrets,
    zone,
    postgres,
    powerSync,
    s3Bucket,
    dnsRecords,
    clientRedirectRule,
    apiWorker,
    clientWorker,
  ];
}
