import { ApiWorkerResource } from './api-worker';
import { ClientPagesDomainResource } from './client-pages-domains';
import { ClientPagesProjectResource } from './client-pages-project';
import { ClientRedirectRuleResource } from './client-redirect-rule';
import { ClientResource } from './client';
import { DnsRecordsResource } from './dns-records';
import { DopplerResource } from './doppler';
import { PlanetScalePostgres } from './planetscale-postgres';
import { PostgresHyperdriveResource } from './postgres-hyperdrive';
import { TtsAudioBucketResource, TurboCacheBucketResource } from './r2-buckets';
import { R2SubscriptionResource } from './r2-subscription';
import { TurboCacheWafBotSkipRuleResource } from './turbo-cache-waf-bot-skip-rule';
import { TurboCacheWorkerResource } from './turbo-cache-worker';
import type { Resource } from './types';
import { ZoneResource } from './zone';

export function createRegistry(): readonly Resource[] {
  const doppler = new DopplerResource();
  const r2Subscription = new R2SubscriptionResource();
  const zone = new ZoneResource();
  const clientPagesProject = new ClientPagesProjectResource();
  const planetscalePostgres = new PlanetScalePostgres();
  const ttsAudioBucket = new TtsAudioBucketResource();
  const turboCacheBucket = new TurboCacheBucketResource();
  const dnsRecords = new DnsRecordsResource();
  const clientPagesDomain = new ClientPagesDomainResource();
  const clientRedirectRule = new ClientRedirectRuleResource();
  const turboCacheWafBotSkipRule = new TurboCacheWafBotSkipRuleResource();
  const turboCacheWorker = new TurboCacheWorkerResource();
  const postgresHyperdrive = new PostgresHyperdriveResource();
  const apiWorker = new ApiWorkerResource();
  const client = new ClientResource();

  r2Subscription.needs(doppler);
  zone.needs(doppler);
  clientPagesProject.needs(doppler);
  planetscalePostgres.needs(doppler);
  ttsAudioBucket.needs(r2Subscription);
  turboCacheBucket.needs(r2Subscription);
  dnsRecords.needs(zone, clientPagesProject);
  clientPagesDomain.needs(clientPagesProject);
  clientRedirectRule.needs(zone);
  turboCacheWafBotSkipRule.needs(zone);
  // The Worker binds to its bucket, so reverse-topo destroy tears
  // down the Worker before the bucket it reads from.
  turboCacheWorker.needs(doppler, turboCacheBucket);
  postgresHyperdrive.needs(doppler, planetscalePostgres);
  apiWorker.needs(planetscalePostgres, dnsRecords, postgresHyperdrive);
  client.needs(apiWorker, dnsRecords);

  return [
    doppler,
    r2Subscription,
    zone,
    clientPagesProject,
    planetscalePostgres,
    ttsAudioBucket,
    turboCacheBucket,
    dnsRecords,
    clientPagesDomain,
    clientRedirectRule,
    turboCacheWafBotSkipRule,
    turboCacheWorker,
    postgresHyperdrive,
    apiWorker,
    client,
  ];
}
