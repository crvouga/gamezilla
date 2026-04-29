import { Button, Card, Stack, Text } from '@gamezilla/lib/ui';
import { useLingui } from '@lingui/react/macro';
import { PEERS, type PeerId } from '../simulator/playground';
import type { TrustElectionControls } from '../pages/use-trust-election';

function VoterRow({
  voter,
  selected,
  onSelect,
}: {
  voter: PeerId;
  selected: PeerId;
  onSelect: (candidate: PeerId) => void;
}) {
  const { t } = useLingui();
  return (
    <Stack spacing={1}>
      <Text variant="caption" label={t`${voter} trusts:`} />
      <Stack direction="horizontal" spacing={2} wrap>
        {PEERS.map((candidate) => (
          <Button
            key={`${voter}-${candidate}`}
            title={candidate}
            size="sm"
            variant={candidate === selected ? 'solid' : 'outlined'}
            onPress={() => onSelect(candidate)}
          />
        ))}
      </Stack>
    </Stack>
  );
}

export function TrustElectionSection({
  election,
}: {
  election: TrustElectionControls;
}) {
  const { t } = useLingui();
  const projectedX = election.projectedTrustMap['player-x'];
  const projectedO = election.projectedTrustMap['player-o'];
  const projectedS = election.projectedTrustMap.server;
  return (
    <Card elevation={1} sx={{ p: 4, gap: 3 }}>
      <Text variant="label" label={t`Trust Election`} />
      {PEERS.map((voter) => (
        <VoterRow
          key={voter}
          voter={voter}
          selected={election.rankings[voter][0] ?? voter}
          onSelect={(candidate) => election.setTopChoice(voter, candidate)}
        />
      ))}
      <Stack direction="horizontal" spacing={2} wrap>
        <Button title={t`Apply Election`} size="sm" onPress={election.applyElection} />
        <Button
          title={t`Reset Preferences`}
          variant="outlined"
          size="sm"
          onPress={election.resetRankings}
        />
      </Stack>
      <Text
        variant="caption"
        label={t`Projected trust — X:${projectedX} O:${projectedO} S:${projectedS}`}
      />
      {election.history.slice(-5).map((entry, idx) => {
        const runNumber =
          election.history.length -
          (election.history.slice(-5).length - idx) +
          1;
        const authority = entry.authority;
        const trustX = entry.trustMap['player-x'];
        const trustO = entry.trustMap['player-o'];
        const trustS = entry.trustMap.server;
        return (
          <Text
            key={`${entry.authority}-${idx}`}
            variant="caption"
            label={t`Run ${runNumber}: authority=${authority} trust(X:${trustX} O:${trustO} S:${trustS})`}
          />
        );
      })}
    </Card>
  );
}
