import { i18n } from '@lingui/core';
import { clientCatalogBootstrap } from './catalog-bootstrap';
import { messages } from './locales/en/messages';

void clientCatalogBootstrap;

// Catalog must stay in lockstep with `lingui extract` (see `//#ci:i18n`).
// A missing key renders the hashed id in production unless Babel keeps
// `message` (`descriptorFields: 'all'` in babel.config.js).
i18n.loadAndActivate({ locale: 'en', messages });

export { i18n };
