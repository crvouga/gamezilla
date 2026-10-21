/**
 * Lingui runtime for the Solid shell. Loads the compiled English catalog
 * (`locales/en/messages.ts`, gitignored output of `bun run i18n:compile`
 * over the `.po` that `@libs/tools-harness-ts#ci:i18n` keeps in lockstep) without
 * the RN `catalog-bootstrap` macro module, which only compiles under Babel
 * for `.ts` files. A missing key still renders English because the Solid
 * macro plugin keeps `message` on descriptors (`descriptorFields: 'all'`).
 */

import { i18n } from '@lingui/core';

import { messages } from '../locales/en/messages';

i18n.loadAndActivate({ locale: 'en', messages });

export { i18n };
