/** @jsxImportSource hono/jsx */
import type { DevIdpUserProfile } from '../dev-idp-user-store';

import { ChooserHeader } from './chooser-header';
import { GlobalStyles } from './global-styles';
import { c } from './styles';
import { ThemePrePaintScript } from './theme-pre-paint';

/** Wire shape of the config the server hands to the client bundle. */
export type DevIdpClientConfig = {
  readonly completeActionPath: string;
  readonly usersApiPath: string;
  readonly oauthParams: Readonly<Record<string, string>>;
  readonly initialUsers: readonly DevIdpUserProfile[];
};

function jsonSafeForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function clientHostFromRedirect(redirectUri: string): string {
  if (redirectUri.length === 0) return '';
  try {
    return new URL(redirectUri).host;
  } catch {
    return '';
  }
}

export const ChooserPage = (props: {
  config: DevIdpClientConfig;
  clientBundleUrl: string;
}) => {
  const { config, clientBundleUrl } = props;
  const host = clientHostFromRedirect(config.oauthParams['redirect_uri'] ?? '');
  const pillVisible = host.length > 0;
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>Dev IdP — Sign in</title>
        <ThemePrePaintScript />
        <GlobalStyles />
      </head>
      <body class={c.body} data-app-state="loading" data-testid="dev-idp-page">
        <main
          class={c.card}
          data-testid="dev-idp-app"
          aria-labelledby="dev-idp-title"
        >
          <ChooserHeader />
          <h1 id="dev-idp-title" class={c.title} data-testid="dev-idp-title">
            Sign in
          </h1>
          <p class={c.subtitle} data-testid="dev-idp-subtitle">
            to continue
          </p>
          <div
            class={c.clientPill}
            data-testid="dev-idp-client-pill"
            data-state={pillVisible ? 'visible' : 'hidden'}
            data-host={host}
            hidden={!pillVisible}
          >
            {host}
          </div>
          <div id="dev-idp-main-mount" data-testid="dev-idp-main-mount" />
          <aside
            class={c.disclaimer}
            data-testid="dev-idp-disclaimer"
            role="note"
          >
            This is the local development identity provider. It behaves like a
            real social login and only runs against a local API origin.
          </aside>
          <footer class={c.foot} data-testid="dev-idp-foot">
            <div
              data-testid="dev-idp-foot-path"
              data-complete-action-path={config.completeActionPath}
            >
              POST <code>{config.completeActionPath}</code>
            </div>
          </footer>
        </main>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__DEV_IDP_CONFIG__ = ${jsonSafeForScript(config)};`,
          }}
        />
        <script type="module" src={clientBundleUrl} />
      </body>
    </html>
  );
};
