import { defineContext } from '@pkgs/solid-context-client/define-context';
import type { ConfigService } from '@libs/auth-shared/config-service-types';

const context = defineContext<ConfigService>('ConfigService');
export const ConfigServiceProvider = context.Provider;
export const useConfigService = context.use;
