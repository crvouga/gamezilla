import { Trans, useLingui } from '@lingui/solid/macro';
import { CodeBlock } from '@pkgs/ui-root-client/code-block';
import { LoadingState } from '@pkgs/ui-root-client/loading-state';
import { MenuRow } from '@pkgs/ui-root-client/menu-row';
import { MenuSection } from '@pkgs/ui-root-client/menu-section';
import { StackVertical } from '@pkgs/ui-root-client/stack';
import { P } from '@pkgs/ui-root-client/text';
import { type JSX, Show } from 'solid-js';
import { useClientConfig } from './use-client-config';

function onOff(enabled: boolean, on: string, off: string): string {
  return enabled ? on : off;
}

/** Grouped read-only view of the synced `client_config` rows. */
export function ClientConfigEntityCard(): JSX.Element {
  const { t } = useLingui();
  const state = useClientConfig();
  const jsonPreview = () =>
    JSON.stringify(
      {
        parsed: state.config(),
        rows: state.rows().map((r) => ({
          id: r.id,
          value: r.value,
        })),
      },
      null,
      2
    );

  return (
    <Show
      when={!state.isLoading()}
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
            value={onOff(state.config().google_enabled, t`On`, t`Off`)}
            {...(state.config().google_web_client_id !== null
              ? { caption: state.config().google_web_client_id }
              : {})}
          />
        </MenuSection>
        <MenuSection title={<Trans>Features</Trans>}>
          <MenuRow
            title={<Trans>Billing</Trans>}
            value={onOff(state.config().billing_enabled, t`On`, t`Off`)}
          />
          <MenuRow
            title={<Trans>Text to speech</Trans>}
            value={onOff(state.config().tts_enabled, t`On`, t`Off`)}
          />
          <MenuRow
            title={<Trans>LLM</Trans>}
            value={onOff(state.config().llm_enabled, t`On`, t`Off`)}
          />
        </MenuSection>
        <MenuSection title={<Trans>Infrastructure</Trans>}>
          <MenuRow
            title={<Trans>EMQX</Trans>}
            value={state.config().emqx_wss_url ?? t`Not set`}
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
