import { ApiWorkerResource } from './api-worker';
import { LegacyCloudflareStackResource } from './legacy-cloudflare-stack';
import { S3BucketResource } from './s3-bucket';
import { ClientRedirectRuleResource } from './client-redirect-rule';
import { DnsRecordsResource } from './dns-records';
import { SecretsResource } from './secrets';
import { PlanetScalePostgres } from './planetscale-postgres';
import type { Resource } from './types';
import { ZoneResource } from './zone';

export function createRegistry(): readonly Resource[] {
  const secrets = new SecretsResource();
  const zone = new ZoneResource();
  const planetscalePostgres = new PlanetScalePostgres();
  const s3Bucket = new S3BucketResource();
  const dnsRecords = new DnsRecordsResource();
  const clientRedirectRule = new ClientRedirectRuleResource();
  const apiWorker = new ApiWorkerResource();
  const legacyCloudflareStack = new LegacyCloudflareStackResource();

  zone.needs(secrets);
  planetscalePostgres.needs(secrets);
  s3Bucket.needs(secrets);
  dnsRecords.needs(zone);
  clientRedirectRule.needs(zone);
  apiWorker.needs(planetscalePostgres, dnsRecords, s3Bucket);

  return [
    secrets,
    zone,
    planetscalePostgres,
    s3Bucket,
    dnsRecords,
    clientRedirectRule,
    apiWorker,
    legacyCloudflareStack,
  ];
}
