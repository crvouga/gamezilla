import type { AvatarConfig } from '@libs/profile-shared-ts/avatar-config';
import { resolveAvatarSeed } from '@libs/profile-shared-ts/avatar-config';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans } from '@lingui/solid/macro';
import { AvatarHero } from '@pkgs/ui-root-client-ts/avatar-hero';
import { ConfirmationModal } from '@pkgs/ui-root-client-ts/confirmation-modal';
import { FormScreen } from '@pkgs/ui-root-client-ts/form-screen';
import { Skeleton } from '@pkgs/ui-root-client-ts/skeleton';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import type { JSX } from 'solid-js';
import { createMemo, For, Show } from 'solid-js';
import { avatarEditorFields, avatarStyleKey } from './avatar-editor-fields';
import {
  BackgroundColorPicker,
  StyleCombobox,
  TraitCombobox,
} from './avatar-editor-pickers';
import { AvatarEditorSeedField } from './avatar-editor-seed-field';
import { selectedVariantForField } from './option-helpers';
import { ProfileDiceBearAvatar } from './patch-avatar-profile-dicebear-avatar';

const HERO_SIZE = 160;

/** Whether the saved avatar is still reading or the draft is editable. */
export type AvatarEditorStatus = 'loading' | 'ready';

export type AvatarEditorScreenViewProps = {
  readonly status: AvatarEditorStatus;
  /** The look being edited; starts as the saved avatar. */
  readonly draft: AvatarConfig;
  /** The profile (or device) id a blank seed falls back to. */
  readonly seedFallback: string;
  /** The draft differs from the saved avatar and there is a profile to save to. */
  readonly canSave: boolean;
  /** The seed was just copied: the copy button confirms it for a moment. */
  readonly seedCopied: boolean;
  /** Leaving with unsaved changes asks first. */
  readonly confirmingDiscard: boolean;
  /** Inline notice for a refused avatar change, under the preview. */
  readonly notice?: JSX.Element;
  readonly onDraftChange: (draft: AvatarConfig) => void;
  readonly onRandomizeSeed: () => void;
  readonly onCopySeed: () => void;
  /** Breadcrumb and Cancel: leaves, or asks first when the draft is dirty. */
  readonly onBack: () => void;
  readonly onConfirmDiscard: () => void;
  readonly onKeepEditing: () => void;
  /** Saves the draft; rejects when the change is refused. */
  readonly onSave: () => Promise<void>;
};

function AvatarPreviewSlot(props: {
  ready: boolean;
  config: AvatarConfig;
  seedFallback: string;
}): JSX.Element {
  return (
    <Show
      when={props.ready}
      fallback={
        <Skeleton width={HERO_SIZE} height={HERO_SIZE} shape="circle" />
      }
    >
      <ProfileDiceBearAvatar
        config={props.config}
        fallbackSeed={props.seedFallback}
        size={HERO_SIZE}
      />
    </Show>
  );
}

function StyleAndTraits(props: AvatarEditorScreenViewProps): JSX.Element {
  const styleKey = createMemo(() => avatarStyleKey(props.draft));
  const fields = createMemo(() => avatarEditorFields(styleKey()));
  const seed = () => props.draft.seed.trim() || props.seedFallback;
  const setOptions = (options: Record<string, unknown>) =>
    props.onDraftChange({ ...props.draft, options });
  return (
    <>
      <StyleCombobox
        styleKey={styleKey()}
        seed={seed()}
        seedFallback={props.seedFallback}
        onChange={(key) =>
          props.onDraftChange({ ...props.draft, style: key, options: {} })
        }
      />
      <For each={fields().featureEnums}>
        {(field, index) => (
          <TraitCombobox
            field={field}
            styleKey={styleKey()}
            seed={seed()}
            options={props.draft.options}
            selectedVariant={selectedVariantForField(
              field,
              props.draft.options[field.key]
            )}
            seedFallback={props.seedFallback}
            triggerTestId={index() === 0 ? Handles.profileAvatarTrait : null}
            onSelect={(variant) => {
              const next = { ...props.draft.options };
              if (variant === null) delete next[field.key];
              else next[field.key] = [variant];
              setOptions(next);
            }}
          />
        )}
      </For>
      <For each={fields().colorFields}>
        {(field) => (
          <BackgroundColorPicker
            field={field}
            options={props.draft.options}
            onOptionsChange={setOptions}
          />
        )}
      </For>
    </>
  );
}

function EditorContent(props: AvatarEditorScreenViewProps): JSX.Element {
  const heroConfig = createMemo<AvatarConfig>(() => ({
    style: avatarStyleKey(props.draft),
    seed: resolveAvatarSeed(props.draft, props.seedFallback),
    options: props.draft.options,
  }));
  return (
    <StackVertical gap="sm" paddingBottom="lg">
      <AvatarHero size={HERO_SIZE}>
        <AvatarPreviewSlot
          ready={props.status === 'ready'}
          config={heroConfig()}
          seedFallback={props.seedFallback}
        />
      </AvatarHero>
      {props.notice}
      <Show when={props.status === 'ready'}>
        <StackVertical gap="sm">
          <AvatarEditorSeedField
            seed={props.draft.seed}
            onSeedChange={(seed) =>
              props.onDraftChange({ ...props.draft, seed })
            }
            onRandomize={() => props.onRandomizeSeed()}
            onCopy={() => props.onCopySeed()}
            copied={props.seedCopied}
          />
          <StyleAndTraits {...props} />
        </StackVertical>
      </Show>
    </StackVertical>
  );
}

/**
 * `/profile/avatar`, presentational: the avatar preview, seed, style, trait
 * and background pickers, Save / Cancel and the discard confirmation.
 * `AvatarEditorScreen` owns the draft and the save mutation.
 */
export function AvatarEditorScreenView(
  props: AvatarEditorScreenViewProps
): JSX.Element {
  return (
    <>
      <ConfirmationModal
        visible={props.confirmingDiscard}
        title={<Trans>Discard changes?</Trans>}
        message={<Trans>You have unsaved avatar changes.</Trans>}
        confirmLabel={<Trans>Discard</Trans>}
        variant="destructive"
        onConfirm={() => props.onConfirmDiscard()}
        onCancel={() => props.onKeepEditing()}
        confirmDataSet={{ testid: Handles.profileAvatarDiscardConfirm }}
        cancelDataSet={{ testid: Handles.profileAvatarDiscardKeep }}
      />
      <FormScreen
        screenId="avatar-editor"
        breadcrumbs={[
          { name: <Trans>Profile</Trans>, onClick: () => props.onBack() },
          { name: <Trans>Avatar</Trans> },
        ]}
        cancel={{
          label: <Trans>Cancel</Trans>,
          onClick: () => props.onBack(),
          dataSet: { testid: Handles.profileAvatarCancel },
        }}
        submit={{
          label: <Trans>Save</Trans>,
          loadingLabel: <Trans>Saving…</Trans>,
          successLabel: <Trans>Saved</Trans>,
          errorLabel: <Trans>Couldn't save</Trans>,
          operation: () => props.onSave(),
          get disabled() {
            return !props.canSave;
          },
          dataSet: { testid: Handles.profileAvatarSave },
        }}
      >
        <EditorContent {...props} />
      </FormScreen>
    </>
  );
}
