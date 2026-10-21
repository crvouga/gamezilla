import type { ConfigService } from '@libs/auth-shared-ts/config-service-types';
import { defineContext } from '@pkgs/solid-context-client-ts/define-context';

const context = defineContext<ConfigService>('ConfigService');
export const ConfigServiceProvider = context.Provider;
export const useConfigService = context.use;
