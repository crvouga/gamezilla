import { createContext, useContext } from 'react';
import { getApiBaseUrl } from './api-servers';

export interface ConfigService {
  getApiUrl(): string;
}

const ConfigServiceContext = createContext<ConfigService | null>(null);

export function useConfigService(): ConfigService {
  const v = useContext(ConfigServiceContext);
  if (v === null) {
    throw new Error('useConfigService: ConfigServiceContext.Provider missing');
  }
  return v;
}

export const ConfigServiceContextProvider = ConfigServiceContext.Provider;

function createConfigService(): ConfigService {
  const apiUrl = getApiBaseUrl();
  return {
    getApiUrl(): string {
      return apiUrl;
    },
  };
}

export { createConfigService };
