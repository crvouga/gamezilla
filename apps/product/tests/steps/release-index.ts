// @io-wall-ok — production-bundle journeys against their isolated localhost stack.
import '@libs/runtime-harness/journeys.steps';
import './connect-four.steps';
import { readFileSync } from 'node:fs';
import { createGlobalHttpClient } from '@pkgs/http-client-shared/global';
import type { StackManifest } from '../../scripts/manifest';
import { useLiveWorld } from './live-world';

const manifest = JSON.parse(
  readFileSync(process.env['LOCALHOST_STACK_MANIFEST']!, 'utf8')
) as StackManifest;

useLiveWorld({
  webOrigin: manifest.webOrigin,
  apiOrigin: manifest.apiOrigin,
  oauthCallbackOrigin: manifest.apiOrigin,
  http: createGlobalHttpClient(),
});
