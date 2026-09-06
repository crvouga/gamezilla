import { defineContext } from '@pkgs/solid-context/define-context';
import type { ConfigService } from './config-service-types';

const context = defineContext<ConfigService>('ConfigService');
export const ConfigServiceProvider = context.Provider;
export const useConfigService = context.use;
