import { ApiWorkerResource } from './api-worker';
import { DnsRecordsResource } from './dns-records';
import { PagesDomainResource } from './pages-domains';
import { PagesProjectResource } from './pages-project';
import { R2BucketResource } from './r2-buckets';
import { R2SubscriptionResource } from './r2-subscription';
import { RedirectRuleResource } from './redirect-rule';
import { TurboCacheResource } from './turbo-cache';
import type { Resource } from './types';
import { ZoneResource } from './zone';

export function createEnsureRegistry(): readonly Resource[] {
  return [
    new R2SubscriptionResource(),
    new ZoneResource(),
    new R2BucketResource(),
    new PagesProjectResource(),
    new DnsRecordsResource(),
    new PagesDomainResource(),
    new RedirectRuleResource(),
  ];
}

export function createDestroyRegistry(): readonly Resource[] {
  return [
    new R2BucketResource(),
    new TurboCacheResource(),
    new ApiWorkerResource(),
    new PagesDomainResource(),
    new PagesProjectResource(),
    new RedirectRuleResource(),
    new DnsRecordsResource(),
    new ZoneResource(),
  ];
}
