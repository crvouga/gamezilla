import { Button, Card, Stack, Text } from '@gamezilla/lib/ui';
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
  return (
    <Stack spacing={1}>
      <Text variant="caption" label={`${voter} trusts:`} />
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
  return (
    <Card elevation={1} sx={{ p: 4, gap: 3 }}>
      <Text variant="label" label="Trust Election" />
      {PEERS.map((voter) => (
        <VoterRow
          key={voter}
          voter={voter}
          selected={election.rankings[voter][0] ?? voter}
          onSelect={(candidate) => election.setTopChoice(voter, candidate)}
        />
      ))}
      <Stack direction="horizontal" spacing={2} wrap>
        <Button title="Apply Election" size="sm" onPress={election.applyElection} />
        <Button
          title="Reset Preferences"
          variant="outlined"
          size="sm"
          onPress={election.resetRankings}
        />
      </Stack>
      <Text
        variant="caption"
        label={`Projected trust — X:${election.projectedTrustMap['player-x']} O:${election.projectedTrustMap['player-o']} S:${election.projectedTrustMap.server}`}
      />
      {election.history.slice(-5).map((entry, idx) => (
        <Text
          key={`${entry.authority}-${idx}`}
          variant="caption"
          label={`Run ${election.history.length - (election.history.slice(-5).length - idx) + 1}: authority=${entry.authority} trust(X:${entry.trustMap['player-x']} O:${entry.trustMap['player-o']} S:${entry.trustMap.server})`}
        />
      ))}
    </Card>
  );
}
