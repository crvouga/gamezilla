import type {
  ClientConfigDbRow,
  ClientRuntimeConfig,
} from '@libs/app-config-shared-ts/parse-client-config';
import { Trans, useLingui } from '@lingui/solid/macro';
import { CodeBlock } from '@pkgs/ui-root-client-ts/code-block';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuScreen } from '@pkgs/ui-root-client-ts/menu-screen';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Show } from 'solid-js';

function onOff(enabled: boolean, on: string, off: string): string {
  return enabled ? on : off;
}

export type ClientConfigScreenViewProps = {
  /** `loading` until the local SQL watch has hydrated. */
  readonly status: 'loading' | 'ready';
  /** Parsed runtime config (defaults when no rows are synced yet). */
  readonly config: ClientRuntimeConfig;
  /** The raw synced rows, shown in the JSON snapshot. */
  readonly rows: readonly ClientConfigDbRow[];
};

/** Grouped read-only view of the synced `client_config` rows. */
function ClientConfigEntityCard(
  props: ClientConfigScreenViewProps
): JSX.Element {
  const { t } = useLingui();
  const jsonPreview = () =>
    JSON.stringify(
      {
        parsed: props.config,
        rows: props.rows.map((r) => ({
          id: r.id,
          value: r.value,
        })),
      },
      null,
      2
    );

  return (
    <Show
      when={props.status === 'ready'}
      fallback={
        <LoadingState caption={<Trans>Loading client config…</Trans>} />
      }
    >
      <StackVertical gap="xl">
        <MenuSection
          title={<Trans>Sign-in</Trans>}
          footer={
            <Trans>
              Synced from the server on first request. Values come from server
              secrets, not from this device.
            </Trans>
          }
        >
          <MenuRow
            title={<Trans>Google</Trans>}
            value={onOff(props.config.google_enabled, t`On`, t`Off`)}
            {...(props.config.google_web_client_id !== null
              ? { caption: props.config.google_web_client_id }
              : {})}
          />
        </MenuSection>
        <MenuSection title={<Trans>Features</Trans>}>
          <MenuRow
            title={<Trans>Billing</Trans>}
            value={onOff(props.config.billing_enabled, t`On`, t`Off`)}
          />
          <MenuRow
            title={<Trans>Text to speech</Trans>}
            value={onOff(props.config.tts_enabled, t`On`, t`Off`)}
          />
          <MenuRow
            title={<Trans>LLM</Trans>}
            value={onOff(props.config.llm_enabled, t`On`, t`Off`)}
          />
        </MenuSection>
        <MenuSection title={<Trans>Infrastructure</Trans>}>
          <MenuRow
            title={<Trans>EMQX</Trans>}
            value={props.config.emqx_wss_url ?? t`Not set`}
          />
        </MenuSection>
        <StackVertical gap="sm">
          <P variant="label" tone="secondary">
            <Trans>Snapshot (JSON)</Trans>
          </P>
          <CodeBlock wrap aria-label={t`Snapshot (JSON)`}>
            {jsonPreview()}
          </CodeBlock>
        </StackVertical>
      </StackVertical>
    </Show>
  );
}

/**
 * `/more/client-config`, presentational: the synced runtime configuration —
 * sign-in, features, infrastructure and a JSON snapshot — or a loading state
 * until local SQLite hydrates. `ClientConfigScreen` reads the rows.
 */
export function ClientConfigScreenView(
  props: ClientConfigScreenViewProps
): JSX.Element {
  return (
    <MenuScreen
      screenId="client-config"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, href: '/' },
        { name: <Trans>Settings</Trans>, href: '/more' },
        { name: <Trans>Client config</Trans> },
      ]}
    >
      <ClientConfigEntityCard {...props} />
    </MenuScreen>
  );
}
