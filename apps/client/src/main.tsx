/** @jsxImportSource solid-js */
// @io-wall-ok — browser composition root
/**
 * Web entry: builds the wall `ClientEnv` from browser APIs, creates the
 * client and mounts `client.App` (browser `Router`; the URL is the source of
 * truth). `pagehide` releases the sync engines (web OPFS handles).
 */

import { render } from 'solid-js/web';

import '@pkgs/tailwind/tailwind.css';
import '@pkgs/ui/tokens.css';
import '@pkgs/ui/base.css';
import {
  APP_VERSION,
  getCommitHash,
  hasCommitProvenance,
} from '@libs/app-shared/app-metadata';
import { createClient } from '@libs/app-client/create-client';
import {
  browserObservabilityIdentity,
  installBrowserObsHelper,
  setBrowserSessionId,
} from '@libs/app-client/browser-identity';
import { wallClientEnv } from '@libs/app-client/wall-client-env';
import { APP_FEATURE_CLIENTS } from '@libs/runtime-client/app-feature-clients';
import { wallSpaceRoomTransport } from '@libs/spaces-client/wall-room-transport';
import { setMutationCorrelationIdentity } from '@pkgs/sync-engine-shared/interaction-correlation';

const telemetryEnv = import.meta.env as {
  readonly DEV?: boolean;
};
const buildSha = hasCommitProvenance() ? getCommitHash() : 'development';
const clientEnv = wallClientEnv({ room: wallSpaceRoomTransport });
const sessionId = crypto.randomUUID();
setBrowserSessionId(sessionId);
setMutationCorrelationIdentity(sessionId, buildSha);
installBrowserObsHelper();

function initializeObservability() {
  const telemetry = import('@pkgs/observability-client/browser').then(
    ({ createBrowserTelemetry }) =>
      createBrowserTelemetry({
        serviceName: 'gamezilla-client',
        serviceVersion: APP_VERSION,
        environment: telemetryEnv.DEV === true ? 'local' : 'prod',
        buildSha,
        identity: browserObservabilityIdentity,
        document,
        // The API ingress forwards to the configured Collector. The browser
        // never receives backend credentials; vendor changes remain server config.
        otlpUrl: new URL(
          '/api/observability/v1/traces',
          clientEnv.serverUrl
        ).toString(),
      })
  );
  const boundaries = telemetry.then(async (runtime) => {
    const boundariesModule = await import(
      '@libs/app-client/browser-boundaries'
    );
    boundariesModule.setBrowserTraceFlush(() => runtime.forceFlush());
    return boundariesModule.installBrowserObservabilityBoundaries();
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
  loadApp: async () => (await import('@libs/runtime-shared/app-features')).APP,
  poolGlobalKey: '__gamezilla_sync_engine_pool__',
});

window.addEventListener('pagehide', () => {
  void client.close();
  void observability.boundaries.then((remove) => remove());
  void observability.telemetry.then((runtime) => runtime.forceFlush());
});

render(() => <client.App />, root);
