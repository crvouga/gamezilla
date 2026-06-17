import { ApiWorkerResource } from './api-worker';
import { S3BucketResource } from './s3-bucket';
import { ClientRedirectRuleResource } from './client-redirect-rule';
import { DnsRecordsResource } from './dns-records';
import { VaultResource } from './vault';
import { PlanetScalePostgres } from './planetscale-postgres';
import type { Resource } from './types';
import { ZoneResource } from './zone';

export function createRegistry(): readonly Resource[] {
  const vault = new VaultResource();
  const zone = new ZoneResource();
  const planetscalePostgres = new PlanetScalePostgres();
  const s3Bucket = new S3BucketResource();
  const dnsRecords = new DnsRecordsResource();
  const clientRedirectRule = new ClientRedirectRuleResource();
  const apiWorker = new ApiWorkerResource();

  zone.needs(vault);
  planetscalePostgres.needs(vault);
  s3Bucket.needs(vault);
  dnsRecords.needs(zone);
  clientRedirectRule.needs(zone);
  apiWorker.needs(planetscalePostgres, dnsRecords, s3Bucket);

  return [
    vault,
    zone,
    planetscalePostgres,
    s3Bucket,
    dnsRecords,
    clientRedirectRule,
    apiWorker,
  ];
}
