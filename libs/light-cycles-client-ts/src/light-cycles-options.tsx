import { Trans } from '@lingui/solid/macro';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { TextInput } from '@pkgs/ui-root-client-ts/text-input';
import { createSignal, Show } from 'solid-js';
import { decodeLightCycles } from './light-cycles-board';

/** The creator chooses how many round wins finish the game, before it starts. */
export function LightCyclesOptions(props: {
  position: string;
  onChoice: (choice: string) => Promise<void>;
}) {
  const [target, setTarget] = createSignal(
    String(decodeLightCycles(props.position)?.targetScore ?? 3)
  );
  const valid = () => /^[1-9]$/.test(target());
  return (
    <StackVertical gap="md">
      <TextInput
        label={<Trans>Round wins to win</Trans>}
        type="number"
        value={target()}
        onChangeText={setTarget}
        dataSet={{ testid: 'light-cycles-target-score' }}
      />
      <Show
        when={valid()}
        fallback={
          <P
            variant="caption"
            tone="destructive"
            testId="light-cycles-target-score-refused"
          >
            <Trans>The target score must be from 1 to 9.</Trans>
          </P>
        }
      >
        <P variant="caption" tone="secondary">
          <Trans>
            Choose a whole number from 1 to 9. Changing it asks every rider to
            get ready again.
          </Trans>
        </P>
      </Show>
      <GameActionButton
        title={<Trans>Use this target score</Trans>}
        disabled={!valid()}
        operation={() => props.onChoice(target())}
        dataSet={{ testid: 'light-cycles-apply-target-score' }}
      />
    </StackVertical>
  );
}
