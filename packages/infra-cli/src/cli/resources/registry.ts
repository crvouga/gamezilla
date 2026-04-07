import { ApiWorkerResource } from './api-worker';
import { ClientPagesResource } from './client-pages';
import { DatabaseResource } from './database';
import { DnsZoneResource } from './dns-zone';
import { TerraformResource } from './terraform';
import type { Resource } from './types';

export function createDestroyRegistry(): readonly Resource[] {
  return [
    new ApiWorkerResource(),
    new ClientPagesResource(),
    new DatabaseResource(),
    new DnsZoneResource(),
    new TerraformResource(),
  ];
}
