import { ApiWorkerResource } from './api-worker';
import { ClientResource } from './client';
import { DnsRecordsResource } from './dns-records';
import { DopplerResource } from './doppler';
import { HyperdriveResource } from './hyperdrive';
import { PagesDomainResource } from './pages-domains';
import { PagesProjectResource } from './pages-project';
import { PlanetScalePostgres } from './planetscale-postgres';
import { R2BucketResource } from './r2-buckets';
import { R2SubscriptionResource } from './r2-subscription';
import { RedirectRuleResource } from './redirect-rule';
import { TurboCacheResource } from './turbo-cache';
import type { Resource } from './types';
import { WafBotSkipRuleResource } from './waf-bot-skip-rule';
import { ZoneResource } from './zone';

export function createRegistry(): readonly Resource[] {
  const doppler = new DopplerResource();
  const r2Subscription = new R2SubscriptionResource();
  const zone = new ZoneResource();
  const pagesProject = new PagesProjectResource();
  const planetscalePostgres = new PlanetScalePostgres();
  const r2Bucket = new R2BucketResource();
  const dnsRecords = new DnsRecordsResource();
  const pagesDomain = new PagesDomainResource();
  const redirectRule = new RedirectRuleResource();
  const wafBotSkipRule = new WafBotSkipRuleResource();
  const turboCache = new TurboCacheResource();
  const hyperdrive = new HyperdriveResource();
  const apiWorker = new ApiWorkerResource();
  const client = new ClientResource();

  r2Subscription.needs(doppler);
  zone.needs(doppler);
  pagesProject.needs(doppler);
  planetscalePostgres.needs(doppler);
  r2Bucket.needs(r2Subscription);
  dnsRecords.needs(zone, pagesProject);
  pagesDomain.needs(pagesProject);
  redirectRule.needs(zone);
  wafBotSkipRule.needs(zone);
  turboCache.needs(doppler, r2Bucket);
  hyperdrive.needs(doppler, planetscalePostgres);
  apiWorker.needs(planetscalePostgres, dnsRecords, hyperdrive);
  client.needs(apiWorker, dnsRecords);

  return [
    doppler,
    r2Subscription,
    zone,
    pagesProject,
    planetscalePostgres,
    r2Bucket,
    dnsRecords,
    pagesDomain,
    redirectRule,
    wafBotSkipRule,
    turboCache,
    hyperdrive,
    apiWorker,
    client,
  ];
}
