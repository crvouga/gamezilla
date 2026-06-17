import { ApiWorkerResource } from './api-worker';
import { B2BucketResource } from './b2-buckets';
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
  const b2Bucket = new B2BucketResource();
  const dnsRecords = new DnsRecordsResource();
  const clientRedirectRule = new ClientRedirectRuleResource();
  const apiWorker = new ApiWorkerResource();

  zone.needs(vault);
  planetscalePostgres.needs(vault);
  b2Bucket.needs(vault);
  dnsRecords.needs(zone);
  clientRedirectRule.needs(zone);
  apiWorker.needs(planetscalePostgres, dnsRecords, b2Bucket);

  return [
    vault,
    zone,
    planetscalePostgres,
    b2Bucket,
    dnsRecords,
    clientRedirectRule,
    apiWorker,
  ];
}
