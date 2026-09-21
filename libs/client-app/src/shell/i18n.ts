/**
 * Lingui runtime for the Solid shell. Loads the compiled English catalog
 * (`i18n/locales/en/messages.ts`, kept in lockstep by `//#ci:i18n`) without
 * the RN `catalog-bootstrap` macro module, which only compiles under Babel
 * for `.ts` files. A missing key still renders English because the Solid
 * macro plugin keeps `message` on descriptors (`descriptorFields: 'all'`).
 */

import { i18n } from '@lingui/core';

import { messages } from '../i18n/locales/en/messages';

i18n.loadAndActivate({ locale: 'en', messages });

export { i18n };
