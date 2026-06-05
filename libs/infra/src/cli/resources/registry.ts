import { ApiWorkerResource } from './api-worker';
import { ClientPagesDomainResource } from './client-pages-domains';
import { ClientPagesProjectResource } from './client-pages-project';
import { ClientRedirectRuleResource } from './client-redirect-rule';
import { ClientResource } from './client';
import { DnsRecordsResource } from './dns-records';
import { DopplerResource } from './doppler';
import { PlanetScalePostgres } from './planetscale-postgres';
import { PostgresHyperdriveResource } from './postgres-hyperdrive';
import { R2BucketResource } from './r2-buckets';
import { R2SubscriptionResource } from './r2-subscription';
import type { Resource } from './types';
import { ZoneResource } from './zone';

export function createRegistry(): readonly Resource[] {
  const doppler = new DopplerResource();
  const r2Subscription = new R2SubscriptionResource();
  const zone = new ZoneResource();
  const clientPagesProject = new ClientPagesProjectResource();
  const planetscalePostgres = new PlanetScalePostgres();
  const r2Bucket = new R2BucketResource();
  const dnsRecords = new DnsRecordsResource();
  const clientPagesDomain = new ClientPagesDomainResource();
  const clientRedirectRule = new ClientRedirectRuleResource();
  const postgresHyperdrive = new PostgresHyperdriveResource();
  const apiWorker = new ApiWorkerResource();
  const client = new ClientResource();

  r2Subscription.needs(doppler);
  zone.needs(doppler);
  clientPagesProject.needs(doppler);
  planetscalePostgres.needs(doppler);
  r2Bucket.needs(r2Subscription);
  dnsRecords.needs(zone, clientPagesProject);
  clientPagesDomain.needs(clientPagesProject);
  clientRedirectRule.needs(zone);
  postgresHyperdrive.needs(doppler, planetscalePostgres);
  apiWorker.needs(planetscalePostgres, dnsRecords, postgresHyperdrive, r2Bucket);
  client.needs(apiWorker, dnsRecords);

  return [
    doppler,
    r2Subscription,
    zone,
    clientPagesProject,
    planetscalePostgres,
    r2Bucket,
    dnsRecords,
    clientPagesDomain,
    clientRedirectRule,
    postgresHyperdrive,
    apiWorker,
    client,
  ];
}
