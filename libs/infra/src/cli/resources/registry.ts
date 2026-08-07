import { ApiWorkerResource } from './api-worker';
import { ClientRedirectRuleResource } from './client-redirect-rule';
import { ClientWorkerResource } from './client-worker';
import { DnsRecordsResource } from './dns-records';
import { EmqxResource } from './emqx';
import { PostgresResource } from './postgres';
import { S3BucketResource } from './s3-bucket';
import { SecretsResource } from './secrets';
import type { Resource } from './types';
import { ZoneResource } from './zone';

export function createRegistry(): readonly Resource[] {
  const secrets = new SecretsResource();
  const zone = new ZoneResource();
  const postgres = new PostgresResource();
  const s3Bucket = new S3BucketResource();
  const dnsRecords = new DnsRecordsResource();
  const clientRedirectRule = new ClientRedirectRuleResource();
  const emqx = new EmqxResource();
  const apiWorker = new ApiWorkerResource();
  const clientWorker = new ClientWorkerResource();

  zone.needs(secrets);
  postgres.needs(secrets);
  s3Bucket.needs(secrets);
  dnsRecords.needs(zone);
  clientRedirectRule.needs(zone);
  emqx.needs(secrets, zone);
  // API first so www/apex custom domains detach before the assets-only Worker
  // claims them.
  apiWorker.needs(postgres, dnsRecords, s3Bucket);
  clientWorker.needs(apiWorker);

  return [
    secrets,
    zone,
    postgres,
    s3Bucket,
    dnsRecords,
    clientRedirectRule,
    emqx,
    apiWorker,
    clientWorker,
  ];
}
