#!/usr/bin/env bun
// @io-wall-ok — deploy CLI entry.
/**
 * Ships the global OAuth callback relay Worker. Runs in the Release workflow's
 * fleet job, before any environment deploys, so a new env file's sign-ins
 * return home from its very first deploy. Its hostname is bound afterwards by
 * the OpenTofu fleet stack.
 */
import { join } from 'node:path';
import { GLOBAL } from '@libs/infra-shared-ts/global';
import { ok } from '@libs/secrets-server-ts/fmt';
import { deployAuthRelayWorker } from '../../../libs/infra-server-ts/scripts/worker-deploy';

deployAuthRelayWorker({ appDir: join(import.meta.dirname, '..') });
ok('Auth relay Worker', `released as ${GLOBAL.auth_relay.worker}`);
