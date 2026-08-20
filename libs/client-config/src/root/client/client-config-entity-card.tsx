import { Trans } from '@lingui/react/macro';
import { Box, Card, Text } from '@pkgs/ui';
import { useClientConfig } from '../../public/use-client-config';

export function ClientConfigEntityCard() {
  const { config, rows } = useClientConfig();
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
    <Card elevation={1} sx={{ p: 4, gap: 3 }}>
      <Text
        variant="bodyBold"
        label={<Trans>Local sync (client_config)</Trans>}
      />
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label={
          <Trans>
            Key/value scalar rows from sync. Worker materializes these from
            secrets on first API request.
          </Trans>
        }
      />
      <Box sx={{ gap: 1 }}>
        <Text variant="label" label={<Trans>Google</Trans>} />
        <Text
          variant="mono"
          selectable
          label={`${config.google_enabled ? 'on' : 'off'}${
            config.google_web_client_id !== null
              ? ` · ${config.google_web_client_id}`
              : ''
          }`}
        />
      </Box>
      <Box sx={{ gap: 1 }}>
        <Text variant="label" label={<Trans>Email / password</Trans>} />
        <Text
          variant="mono"
          label={config.email_password_enabled ? 'on' : 'off'}
        />
      </Box>
      <Box sx={{ gap: 1 }}>
        <Text variant="label" label={<Trans>Billing / TTS / LLM</Trans>} />
        <Text
          variant="mono"
          label={`billing=${config.billing_enabled ? 'on' : 'off'} tts=${
            config.tts_enabled ? 'on' : 'off'
          } llm=${config.llm_enabled ? 'on' : 'off'}`}
        />
      </Box>
      <Box sx={{ gap: 1 }}>
        <Text variant="label" label={<Trans>EMQX / Obs</Trans>} />
        <Text
          variant="mono"
          selectable
          label={`emqx=${config.emqx_wss_url ?? 'null'} obs=${config.observability_backend}`}
        />
      </Box>
      <Text variant="label" label={<Trans>Snapshot (JSON)</Trans>} />
      <Text variant="mono" selectable label={jsonPreview} />
    </Card>
  );
}
