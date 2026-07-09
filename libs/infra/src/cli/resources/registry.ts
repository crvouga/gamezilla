import { ApiWorkerResource } from './api-worker';
import { LegacyCloudflareStackResource } from './legacy-cloudflare-stack';
import { S3BucketResource } from './s3-bucket';
import { ClientRedirectRuleResource } from './client-redirect-rule';
import { DnsRecordsResource } from './dns-records';
import { NeonPostgres } from './neon-postgres';
import { PowerSyncResource } from './powersync';
import { SecretsResource } from './secrets';
import type { Resource } from './types';
import { ZoneResource } from './zone';

export function createRegistry(): readonly Resource[] {
  const secrets = new SecretsResource();
  const zone = new ZoneResource();
  const neonPostgres = new NeonPostgres();
  const powerSync = new PowerSyncResource();
  const s3Bucket = new S3BucketResource();
  const dnsRecords = new DnsRecordsResource();
  const clientRedirectRule = new ClientRedirectRuleResource();
  const apiWorker = new ApiWorkerResource();
  const legacyCloudflareStack = new LegacyCloudflareStackResource();

  zone.needs(secrets);
  neonPostgres.needs(secrets);
  powerSync.needs(secrets, neonPostgres);
  s3Bucket.needs(secrets);
  dnsRecords.needs(zone);
  clientRedirectRule.needs(zone);
  apiWorker.needs(neonPostgres, dnsRecords, s3Bucket);

  return [
    secrets,
    zone,
    neonPostgres,
    powerSync,
    s3Bucket,
    dnsRecords,
    clientRedirectRule,
    apiWorker,
    legacyCloudflareStack,
  ];
}
