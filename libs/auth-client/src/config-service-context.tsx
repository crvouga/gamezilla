import type { ConfigService } from '@libs/auth-shared/config-service-types';
import { defineContext } from '@pkgs/solid-context-client/define-context';

const context = defineContext<ConfigService>('ConfigService');
export const ConfigServiceProvider = context.Provider;
export const useConfigService = context.use;
