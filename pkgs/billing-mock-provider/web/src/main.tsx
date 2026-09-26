// @io-wall-ok — browser entry (composition root) for the hosted pages.
/**
 * Boots the hosted pages over the page's own URL, with the browser's own
 * `fetch` and navigation.
 */
import { globalHttpFetch } from '@pkgs/http-client';
import { render } from 'solid-js/web';

import { MockBillingEmbeddedPage } from './embedded-page';
import './styles.css';

const root = document.getElementById('mock-billing-root');

if (root !== null) {
  render(
    () => (
      <MockBillingEmbeddedPage
        fetch={globalHttpFetch}
        navigate={(target) => window.location.assign(target)}
        setTitle={(title) => {
          document.title = title;
        }}
        url={window.location.href}
      />
    ),
    root
  );
}
