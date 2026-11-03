import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { IconButton } from '@pkgs/ui-root-client-ts/icon-button';
import {
  CircleCheckIcon,
  CopyIcon,
  ShuffleIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { PickerSection } from '@pkgs/ui-root-client-ts/picker-section';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { TextInput } from '@pkgs/ui-root-client-ts/text-input';
import type { JSX } from 'solid-js';

export function AvatarEditorSeedField(props: {
  /**
   * The draft's own seed, not the effective one: empty while the person is
   * retyping it (the avatar falls back to their default look meanwhile).
   */
  seed: string;
  onSeedChange: (seed: string) => void;
  onRandomize: () => void;
  onCopy: () => void;
  /** The seed was just copied: the copy button confirms it for a moment. */
  copied: boolean;
  disabled?: boolean | undefined;
}): JSX.Element {
  const { t } = useLingui();

  return (
    <PickerSection label={<Trans>Seed</Trans>}>
      <StackHorizontal gap="sm" align="end">
        <StackVertical grow>
          <TextInput
            value={props.seed}
            placeholder={t`Empty: your default look`}
            onChangeText={props.onSeedChange}
            aria-label={t`Seed`}
            autocapitalize="none"
            autocorrect="off"
            disabled={props.disabled === true}
            dataSet={{ testid: Handles.profileAvatarSeed }}
          />
        </StackVertical>
        <IconButton
          size={44}
          background="surface"
          onClick={props.onRandomize}
          disabled={props.disabled === true}
          label={t`Randomize`}
        >
          <ShuffleIcon size={20} />
        </IconButton>
        <IconButton
          size={44}
          background="surface"
          onClick={() => props.onCopy()}
          disabled={props.disabled === true}
          label={props.copied ? t`Copied` : t`Copy seed`}
        >
          {props.copied ? (
            <CircleCheckIcon size={20} />
          ) : (
            <CopyIcon size={20} />
          )}
        </IconButton>
      </StackHorizontal>
    </PickerSection>
  );
}
