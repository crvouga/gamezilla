import { pongPositionCodec } from '@libs/pong-shared-ts/pong-game';
import { Trans } from '@lingui/solid/macro';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { TextInput } from '@pkgs/ui-root-client-ts/text-input';
import { createSignal } from 'solid-js';

export function PongOptions(props: {
  position: string;
  onChoice: (choice: string) => Promise<void>;
}) {
  const [target, setTarget] = createSignal(
    String(pongPositionCodec.decode(props.position)?.targetScore ?? 11)
  );
  const valid = () => /^[1-9][0-9]?$/.test(target());
  return (
    <StackVertical gap="md">
      <TextInput
        label={<Trans>Points to win</Trans>}
        type="number"
        value={target()}
        onChangeText={setTarget}
        dataSet={{ testid: 'pong-score-target' }}
      />
      <P variant="caption" tone="secondary">
        <Trans>
          Choose a whole number from 1 to 99. Changing it asks both players to
          get ready again.
        </Trans>
      </P>
      <GameActionButton
        title={<Trans>Use this score</Trans>}
        disabled={!valid()}
        operation={() => props.onChoice(target())}
        dataSet={{ testid: 'pong-apply-score-target' }}
      />
    </StackVertical>
  );
}
