import { ApiWorkerResource } from './api-worker';
import { B2BucketResource } from './b2-buckets';
import { ClientPagesDomainResource } from './client-pages-domains';
import { ClientPagesProjectResource } from './client-pages-project';
import { ClientRedirectRuleResource } from './client-redirect-rule';
import { ClientResource } from './client';
import { DnsRecordsResource } from './dns-records';
import { VaultResource } from './vault';
import { PlanetScalePostgres } from './planetscale-postgres';
import type { Resource } from './types';
import { ZoneResource } from './zone';

export function createRegistry(): readonly Resource[] {
  const vault = new VaultResource();
  const zone = new ZoneResource();
  const clientPagesProject = new ClientPagesProjectResource();
  const planetscalePostgres = new PlanetScalePostgres();
  const b2Bucket = new B2BucketResource();
  const dnsRecords = new DnsRecordsResource();
  const clientPagesDomain = new ClientPagesDomainResource();
  const clientRedirectRule = new ClientRedirectRuleResource();
  const apiWorker = new ApiWorkerResource();
  const client = new ClientResource();

  zone.needs(vault);
  clientPagesProject.needs(vault);
  planetscalePostgres.needs(vault);
  b2Bucket.needs(vault);
  dnsRecords.needs(zone, clientPagesProject);
  clientPagesDomain.needs(clientPagesProject);
  clientRedirectRule.needs(zone);
  apiWorker.needs(planetscalePostgres, dnsRecords, b2Bucket);
  client.needs(apiWorker, dnsRecords);

  return [
    vault,
    zone,
    clientPagesProject,
    planetscalePostgres,
    b2Bucket,
    dnsRecords,
    clientPagesDomain,
    clientRedirectRule,
    apiWorker,
    client,
  ];
}
