// @io-wall-ok — production-bundle journeys against their isolated localhost stack.
import '@libs/runtime-harness-ts/journeys.steps';
import '@libs/runtime-harness-ts/quoridor-journey.steps';
import './battleship.steps';
import './release-sokoban-recovery';
import './bug-reports.steps';
import './connect-four.steps';
import './quoridor.steps';
import { readFileSync } from 'node:fs';
import { createGlobalHttpClient } from '@pkgs/http-client-shared-ts/global';
import type { StackManifest } from '../../scripts/manifest';
import { useLiveWorld } from './live-world';
import { registerBillingPages } from './release-billing-pages';

const manifest = JSON.parse(
  readFileSync(process.env['LOCALHOST_STACK_MANIFEST']!, 'utf8')
) as StackManifest;

registerBillingPages(manifest.billingOrigin);
useLiveWorld({
  webOrigin: manifest.webOrigin,
  apiOrigin: manifest.apiOrigin,
  googleAuthorizationOrigin: manifest.idpOrigins.google,
  oauthCallbackOrigin: manifest.apiOrigin,
  http: createGlobalHttpClient(),
});
