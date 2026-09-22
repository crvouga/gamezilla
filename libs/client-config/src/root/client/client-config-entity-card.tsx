import { Trans, useLingui } from '@lingui/solid/macro';
import { MenuRow, MenuSection } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { useClientConfig } from '../../public/use-client-config';

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
    <div class="box gap-5">
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
      <div class="box gap-2">
        <label class="text textLabel text-text-secondary">
          {<Trans>Snapshot (JSON)</Trans>}
        </label>
        <div class="box bg-surface-muted rounded-control p-3">
          <code class="text textMono select-text">{jsonPreview()}</code>
        </div>
      </div>
    </div>
  );
}
