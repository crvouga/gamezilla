/** @jsxImportSource solid-js */
// @io-wall-ok — browser composition root
import { I18nProvider } from '@lingui/solid';
import { wallClock, wallTimers } from '@pkgs/clock/wall';
import { render } from 'solid-js/web';
import { ExemplarsApp } from './exemplars/exemplars-app';
import { i18n } from './i18n/i18n';

const root = document.getElementById('root');
if (root === null) {
  throw new Error('#root element missing from index.html');
}

render(
  () => (
    <I18nProvider i18n={i18n}>
      <ExemplarsApp clock={wallClock} timers={wallTimers} />
    </I18nProvider>
  ),
  root
);
