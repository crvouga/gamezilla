#!/usr/bin/env bun
// @io-wall-ok — deploy CLI entry.
/**
 * Ships the static Storybook site. Runs in the Release workflow's fleet job
 * after the Storybook build, before the OpenTofu fleet stack binds its
 * hostname.
 */
import { join } from 'node:path';
import { GLOBAL } from '@libs/infra-shared-ts/global';
import { deployStorybookWorker } from '../../../libs/infra-server-ts/scripts/worker-deploy';

deployStorybookWorker({ appDir: join(import.meta.dirname, '..') });
console.log(
  `[storybook] released ${GLOBAL.storybook.worker} at https://${GLOBAL.storybook.hostname}`
);
