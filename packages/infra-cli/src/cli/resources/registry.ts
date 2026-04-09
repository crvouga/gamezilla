import { ApiWorkerResource } from './api-worker';
import { ClientResource } from './client';
import { DatabaseResource } from './database';
import { DnsRecordsResource } from './dns-records';
import { DopplerResource } from './doppler';
import { PagesDomainResource } from './pages-domains';
import { PagesProjectResource } from './pages-project';
import { R2BucketResource } from './r2-buckets';
import { R2SubscriptionResource } from './r2-subscription';
import { RedirectRuleResource } from './redirect-rule';
import { TurboCacheResource } from './turbo-cache';
import type { Resource } from './types';
import { ZoneResource } from './zone';

export function createRegistry(): readonly Resource[] {
  return [
    new DopplerResource(),
    new R2SubscriptionResource(),
    new ZoneResource(),
    new PagesProjectResource(),
    new DatabaseResource(),
    new R2BucketResource(),
    new DnsRecordsResource(),
    new PagesDomainResource(),
    new RedirectRuleResource(),
    new TurboCacheResource(),
    new ApiWorkerResource(),
    new ClientResource(),
  ];
}
