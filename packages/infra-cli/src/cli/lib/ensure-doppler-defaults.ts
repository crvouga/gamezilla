import { PROJECT_CONFIG } from '../../project-config';
import { ok } from './fmt';
import { setDopplerSecret } from '../secrets/secrets';

const DEFAULTS: Record<string, () => string> = {
  TURBO_TOKEN: () => crypto.randomUUID(),
  TURBO_API: () =>
    `https://${PROJECT_CONFIG.cloudflare.turboCacheWorker}.${PROJECT_CONFIG.cloudflare.accountSubdomain}.workers.dev`,
  TURBO_TEAM: () => `team_${PROJECT_CONFIG.domain.replace(/\.\w+$/, '')}`,
  TURBO_LOG_ORDER: () => 'stream',
  EXPO_PUBLIC_API_URL: () => `https://api.${PROJECT_CONFIG.domain}`,
};

/**
 * Populate Doppler with default values for config that can be derived
 * automatically (turbo cache URL, team slug, bearer token, log order).
 * Skips keys already present in process.env (i.e. already loaded from Doppler).
 */
export function ensureDopplerDefaults(): void {
  for (const [key, generate] of Object.entries(DEFAULTS)) {
    if (process.env[key]) continue;

    const value = generate();
    process.env[key] = value;

    try {
      setDopplerSecret(key, value);
      ok(key, 'populated in Doppler');
    } catch {
      ok(key, 'set in env (Doppler save skipped)');
    }
  }
}
