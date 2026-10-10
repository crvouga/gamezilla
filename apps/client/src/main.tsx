import {
  installBrowserObservabilityBoundaries,
  setBrowserTraceFlush,
} from '@libs/app-root-client/browser-boundaries';
import { createOfflineHttp } from '@libs/app-root-client/offline-network-http';
import { installBrowserPerformanceTelemetry } from '@libs/app-root-client/wall';
import { APP } from '@libs/runtime-shared/app-features';
import { createBrowserTelemetry } from '@pkgs/observability-root-client/browser';
import { createHttpSpanExporter } from '@pkgs/observability-root-client/http-span-exporter';
import { AcknowledgedLogExporter } from '@pkgs/observability-runtime-shared/acknowledged-log-exporter';
/** @jsxImportSource solid-js */
// @io-wall-ok — browser composition root
/**
 * Web entry: builds the wall `ClientEnv` from browser APIs, creates the
 * client and mounts `client.App` (browser `Router`; the URL is the source of
 * truth). `pagehide` releases the sync engines (web OPFS handles).
 */

import { render } from 'solid-js/web';

import '@pkgs/tailwind-shared/tailwind.css';
import '@pkgs/ui-root-client/tokens.css';
import '@pkgs/ui-root-client/hosts.css';
import {
  browserObservabilityIdentity,
  installBrowserObsHelper,
  setBrowserSessionId,
} from '@libs/app-root-client/browser-identity';
import { createClient } from '@libs/app-root-client/create-client';
import { wallClientEnv } from '@libs/app-root-client/wall-client-env';
import { wallOfflineNetworkController } from '@libs/app-root-client/wall-offline-network';
import {
  APP_VERSION,
  getCommitHash,
  hasCommitProvenance,
} from '@libs/app-root-shared/app-metadata';
import { APP_FEATURE_CLIENTS } from '@libs/runtime-client/app-feature-clients';
import { wallSpaceRoomTransport } from '@libs/spaces-client/wall-room-transport';
import { setMutationCorrelationIdentity } from '@pkgs/sync-engine-shared/interaction-correlation';

const telemetryEnv = import.meta.env as {
  readonly DEV?: boolean;
};
const buildSha = hasCommitProvenance() ? getCommitHash() : 'development';
const offline = wallOfflineNetworkController();
const clientEnv = wallClientEnv({ room: wallSpaceRoomTransport, offline });
const sessionId = crypto.randomUUID();
setBrowserSessionId(sessionId);
setMutationCorrelationIdentity(sessionId, buildSha);
installBrowserObsHelper();

function initializeObservability() {
  const otlpUrl = new URL(
    '/api/observability/v1/traces',
    clientEnv.serverUrl
  ).toString();
  const telemetry = Promise.resolve(
    createBrowserTelemetry({
      serviceName: 'gamezilla-client',
      serviceVersion: APP_VERSION,
      environment: telemetryEnv.DEV === true ? 'local' : 'prod',
      buildSha,
      identity: browserObservabilityIdentity,
      document,
      // The API ingress forwards to the configured Collector. The browser
      // never receives backend credentials; vendor changes remain server config.
      exporter: createHttpSpanExporter({
        url: otlpUrl,
        http: { fetch: createOfflineHttp(offline, clientEnv.server) },
      }),
      otlpUrl: new URL(
        '/api/observability/v1/traces',
        clientEnv.serverUrl
      ).toString(),
      logExporter: new AcknowledgedLogExporter(
        new URL('/api/observability/v1/logs', clientEnv.serverUrl).toString(),
        {},
        { fetch: createOfflineHttp(offline, clientEnv.server) },
        clientEnv.timers
      ),
    })
  );
  const boundaries = telemetry.then((runtime) => {
    const removePerformance = installBrowserPerformanceTelemetry(
      clientEnv.clock.now
    );
    setBrowserTraceFlush(() => runtime.forceFlush());
    const removeBoundaries = installBrowserObservabilityBoundaries();
    return () => {
      removePerformance();
      removeBoundaries();
    };
  });
  return { boundaries, telemetry };
}

const observability = initializeObservability();

const root = document.getElementById('root');
if (root === null) {
  throw new Error('#root element missing from index.html');
}

const client = createClient(clientEnv, {
  features: APP_FEATURE_CLIENTS,
  loadApp: () => Promise.resolve(APP),
  poolGlobalKey: '__gamezilla_sync_engine_pool__',
  offlineController: offline,
});

window.addEventListener('pagehide', () => {
  void client.close();
  void observability.boundaries.then((remove) => remove());
  void observability.telemetry.then((runtime) => runtime.forceFlush());
});

root.replaceChildren();
render(() => <client.App />, root);
