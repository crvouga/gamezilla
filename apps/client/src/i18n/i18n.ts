import { i18n } from '@lingui/core';
import { clientCatalogBootstrap } from './catalog-bootstrap';
import { messages } from './locales/en/messages';

void clientCatalogBootstrap;

i18n.loadAndActivate({ locale: 'en', messages });

export { i18n };
