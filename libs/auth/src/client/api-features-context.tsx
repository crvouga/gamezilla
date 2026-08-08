import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';

import {
  type ApiFeatures,
  DEFAULT_API_FEATURES,
  parseApiFeatures,
} from '../shared/api-features';
import { useConfigService } from './config-service-context';

type ApiFeaturesState = {
  readonly features: ApiFeatures;
  readonly isHydrated: boolean;
};

const Ctx = createContext<ApiFeaturesState | null>(null);

async function fetchApiFeatures(apiUrl: string): Promise<ApiFeatures> {
  const base = apiUrl.replace(/\/$/, '');
  if (base.length === 0) return DEFAULT_API_FEATURES;
  try {
    const res = await fetch(`${base}/api/features`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return DEFAULT_API_FEATURES;
    const parsed = parseApiFeatures(await res.json());
    return parsed ?? DEFAULT_API_FEATURES;
  } catch {
    return DEFAULT_API_FEATURES;
  }
}

/**
 * Fetches public `/api/features` once so sign-in and optional integrations can
 * degrade without waiting on sync paint.
 */
export function ApiFeaturesProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const apiUrl = useConfigService().getApiUrl();
  const [state, setState] = useState<ApiFeaturesState>({
    features: DEFAULT_API_FEATURES,
    isHydrated: false,
  });

  useEffect(() => {
    let cancelled = false;
    void fetchApiFeatures(apiUrl).then((features) => {
      if (cancelled) return;
      setState({ features, isHydrated: true });
    });
    return () => {
      cancelled = true;
    };
  }, [apiUrl]);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export function useApiFeatures(): ApiFeaturesState {
  const v = useContext(Ctx);
  if (v === null) {
    return { features: DEFAULT_API_FEATURES, isHydrated: false };
  }
  return v;
}
