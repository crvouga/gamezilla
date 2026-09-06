import { Trans, useLingui } from '@lingui/react/macro';
import { Box, MenuRow, MenuSection, Text } from '@pkgs/ui-rn';
import type { ReactNode } from 'react';
import { useClientConfig } from '../../public/use-client-config';

function onOff(enabled: boolean, on: string, off: string): string {
  return enabled ? on : off;
}

/** Grouped read-only view of the synced `client_config` rows. */
export function ClientConfigEntityCard(): ReactNode {
  const { t } = useLingui();
  const { config, rows } = useClientConfig();
  const on = t`On`;
  const off = t`Off`;
  const unset = t`Not set`;
  const jsonPreview = JSON.stringify(
    {
      parsed: config,
      rows: rows.map((r) => ({
        id: r.id,
        value: r.value,
      })),
    },
    null,
    2
  );

  return (
    <Box sx={{ gap: 5 }}>
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
          value={onOff(config.google_enabled, on, off)}
          {...(config.google_web_client_id !== null
            ? { caption: config.google_web_client_id }
            : {})}
        />
        <MenuRow
          title={<Trans>Dev OAuth</Trans>}
          value={onOff(config.dev_oauth_enabled, on, off)}
        />
      </MenuSection>
      <MenuSection title={<Trans>Features</Trans>}>
        <MenuRow
          title={<Trans>Billing</Trans>}
          value={onOff(config.billing_enabled, on, off)}
        />
        <MenuRow
          title={<Trans>Text to speech</Trans>}
          value={onOff(config.tts_enabled, on, off)}
        />
        <MenuRow
          title={<Trans>LLM</Trans>}
          value={onOff(config.llm_enabled, on, off)}
        />
      </MenuSection>
      <MenuSection title={<Trans>Infrastructure</Trans>}>
        <MenuRow
          title={<Trans>EMQX</Trans>}
          value={config.emqx_wss_url ?? unset}
        />
        <MenuRow
          title={<Trans>Observability</Trans>}
          value={config.observability_backend}
        />
      </MenuSection>
      <Box sx={{ gap: 2 }}>
        <Text
          variant="label"
          sx={{ color: 'textSecondary' }}
          label={<Trans>Snapshot (JSON)</Trans>}
        />
        <Box
          sx={{
            backgroundColor: 'surfaceMuted',
            borderRadius: 'md',
            p: 3,
          }}
        >
          <Text variant="mono" selectable label={jsonPreview} />
        </Box>
      </Box>
    </Box>
  );
}
