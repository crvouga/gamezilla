import { ApiWorkerResource } from './api-worker';
import { ClientPagesResource } from './client-pages';
import { TerraformResource } from './terraform';
import type { Resource } from './types';

export function createDestroyRegistry(): readonly Resource[] {
  return [
    new TerraformResource(),
    new ApiWorkerResource(),
    new ClientPagesResource(),
  ];
}
