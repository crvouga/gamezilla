import { Card, Stack, Text } from '@gamezilla/lib/ui';
import type { PeerCryptoSummary, PeerId } from '../simulator/playground';

function short(value: string): string {
  return value.length <= 16 ? value : `${value.slice(0, 8)}...${value.slice(-8)}`;
}

export function CryptoDiagnosticsSection({
  peers,
  authority,
  wireAuthFailures,
}: {
  peers: PeerCryptoSummary[];
  authority: PeerId;
  wireAuthFailures: string[];
}) {
  return (
    <Card elevation={1} sx={{ p: 4, gap: 2 }}>
      <Text variant="label" label="Crypto Diagnostics" />
      <Text variant="caption" label={`Authority: ${authority}`} />
      <Stack spacing={1}>
        {peers.map((peer) => (
          <Text
            key={peer.label}
            variant="caption"
            label={`${peer.label}: id=${short(peer.peerId)} pub=${short(peer.publicKeyB64)}`}
          />
        ))}
      </Stack>
      <Text
        variant="caption"
        label={
          wireAuthFailures.length === 0
            ? 'Wire auth failures: none'
            : `Wire auth failures: ${wireAuthFailures.length}`
        }
      />
    </Card>
  );
}
