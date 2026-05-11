import { mountHostedAuthHandler } from '@gamezilla/auth/server';
import { createAuthApiRoutes } from '@gamezilla/auth/server/auth-routes';
import type { AuthContext } from '@gamezilla/auth/server/types';
import { UnauthorizedError } from '@gamezilla/auth/server/unauthorized-error';
import { appAuth } from '@gamezilla/auth/shared/auth-context';
import { createClientConfigApp } from '@gamezilla/client-config/server/route';
import { assert, ValidationError } from '@gamezilla/lib/assert';
import { createLogger } from '@gamezilla/lib/logger';
import type { PatchDbApiConfig } from '@gamezilla/patch-db/api';
import { createPatchDbApiHandler } from '@gamezilla/patch-db/api';
import { ForbiddenError } from '@gamezilla/patch-db/forbidden-error';
import { createSpaceApp } from '@gamezilla/spaces/server/route';
import { makeStripeClient } from '@gamezilla/stripe/make-stripe-client';
import { createStripeApp } from '@gamezilla/stripe/stripe-app';
import { createTtsAppFromBindings } from '@gamezilla/tts/server';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ApiSecretName } from '../config/secret-names';
import { healthApp } from '../health/route';
import { apiRequestAsyncLocalStorage } from '../request-scope';
import type { ApiHonoEnv } from './api-hono-types';
import type { ApiHandlerConfig } from './config';
import { apiCors } from './cors';
import { createRequestDbMiddleware } from './request-db-middleware';

const log = createLogger({ name: 'api:app' });

export type { ApiHandlerConfig } from './config';

function isAssertionCrash(
  value: unknown
): value is { message: string; context?: Record<string, unknown> } {
  return (
    value !== null &&
    typeof value === 'object' &&
    '__assertion_failure' in value &&
    'message' in value
  );
}

function toPatchDbApiConfig(
  config: ApiHandlerConfig,
  resolvePatchDbContext: (
    req: Request
  ) => Promise<Readonly<Record<string, unknown>>>
): PatchDbApiConfig {
  const { pubSub, basePath, instrumentation } = config;
  const patchDbConfig: PatchDbApiConfig = {
    db: () => {
      const s = apiRequestAsyncLocalStorage.getStore();
      assert.defined(
        s,
        'patch-db host resolver: apiRequestAsyncLocalStorage store missing'
      );
      return s.patchDb;
    },
    pubSub,
    patchDbHttpAuth: {
      resolvePatchDbContext: (req) => resolvePatchDbContext(req),
    },
  };
  if (basePath !== undefined) {
    patchDbConfig.basePath = basePath;
  }
  if (instrumentation !== undefined) {
    patchDbConfig.instrumentation = instrumentation;
  }
  return patchDbConfig;
}

function createApiErrorHandler() {
  return (
    err: unknown,
    c: { json: (body: { error: string }, status: number) => Response }
  ) => {
    if (err instanceof ForbiddenError) {
      return c.json({ error: err.message }, 403);
    }
    if (err instanceof UnauthorizedError) {
      return c.json({ error: err.message }, 401);
    }
    if (err instanceof ValidationError) {
      return c.json({ error: err.message }, 400);
    }
    if (err instanceof HTTPException) {
      return c.json({ error: err.message }, err.status);
    }
    if (isAssertionCrash(err as unknown)) {
      const crash = err as unknown as {
        message: string;
        context?: Record<string, unknown>;
      };
      log.error('assertion failure', {
        error: crash.message,
        context: crash.context,
      });
      return c.json({ error: 'Internal server error' }, 500);
    }
    const message =
      err instanceof Error ? err.message : 'Internal server error';
    log.error('handler error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return c.json({ error: message }, 500);
  };
}

async function resolveStripeClient(
  secretStore: ApiHandlerConfig['secretStore']
): Promise<ReturnType<typeof makeStripeClient> | null> {
  const raw = await secretStore.getOptional(ApiSecretName.stripeSecretKey);
  const key =
    typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
  return key !== null ? makeStripeClient(key) : null;
}

async function resolveTtsApp(config: ApiHandlerConfig) {
  const { secretStore, ttsAudioBucket } = config;
  const ttsApp =
    ttsAudioBucket !== undefined
      ? await createTtsAppFromBindings({
          secretStore,
          r2Bucket: ttsAudioBucket,
        })
      : null;
  if (ttsApp === null) {
    log.warn('tts routes not mounted', {
      reason:
        ttsAudioBucket === undefined
          ? 'TTS_AUDIO R2 binding missing — add [[r2_buckets]] to wrangler.toml'
          : `${ApiSecretName.elevenLabsApiKey} unset in Doppler — set it to enable TTS`,
    });
  } else {
    log.info('tts routes mounted', {
      paths: ['/tts/synthesize', '/tts/audio/:hash'],
    });
  }
  return ttsApp;
}

function buildStripeSubApp(
  config: ApiHandlerConfig,
  stripe: ReturnType<typeof makeStripeClient> | null
) {
  return createStripeApp({
    getPatchDb: () => {
      const s = apiRequestAsyncLocalStorage.getStore();
      assert.defined(s, 'stripe: request store missing');
      return s.patchDb;
    },
    secretStore: config.secretStore,
    stripe,
    requireAuth: async (d, req) => {
      const s = apiRequestAsyncLocalStorage.getStore();
      assert.defined(s, 'stripe auth: request store missing');
      const ctx = await s.sessionAuth.requireAuthContext(d, req);
      const auth = appAuth(ctx);
      if (auth === null || auth.accountId === null) {
        throw new UnauthorizedError(
          'Stripe routes require a signed-in account'
        );
      }
      return { accountId: auth.accountId, deviceId: auth.deviceId };
    },
    webhookSecretDopplerKey: ApiSecretName.stripeWebhookSecret,
  });
}

/**
 * Composes the API Worker app from mounted sub-apps (`app.route()`), per
 * [Hono best practices](https://hono.dev/docs/guides/best-practices).
 */
export async function createApiApp(config: ApiHandlerConfig) {
  const { secretStore } = config;
  const [stripe, ttsApp] = await Promise.all([
    resolveStripeClient(secretStore),
    resolveTtsApp(config),
  ]);

  const { honoApp: patchDbApp, basePath: resolvedBase } =
    createPatchDbApiHandler(
      toPatchDbApiConfig(config, (req) => {
        const s = apiRequestAsyncLocalStorage.getStore();
        assert.defined(
          s,
          'resolvePatchDbContext: apiRequestAsyncLocalStorage store missing'
        );
        return s.sessionAuth.resolvePatchDbContext(s.patchDb, req);
      })
    );
  /** RPC client keys use the literal mount path; wire URL stays `basePath`-driven. */
  const patchMount = resolvedBase as '/patch-db';

  const baseApp = new Hono<ApiHonoEnv<AuthContext>>()
    .use('*', createRequestDbMiddleware(secretStore))
    .use('*', apiCors)
    .route('/', healthApp)
    .route('/', createClientConfigApp(log, secretStore))
    .route('/', createAuthApiRoutes());

  const app = (ttsApp !== null ? baseApp.route('/', ttsApp) : baseApp)
    .route('/', buildStripeSubApp(config, stripe))
    .route('/', createSpaceApp())
    .route(patchMount, patchDbApp)
    .onError(createApiErrorHandler());

  await mountHostedAuthHandler(app, secretStore);
  return app;
}
