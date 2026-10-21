import type { AvatarConfig } from '@libs/profile-shared/avatar-config';
import { Handles } from '@libs/test-ids-shared/handles';
import { Trans } from '@lingui/solid/macro';
import { AvatarHero } from '@pkgs/ui-root-client/avatar-hero';
import { ConfirmationModal } from '@pkgs/ui-root-client/confirmation-modal';
import { FormScreen } from '@pkgs/ui-root-client/form-screen';
import { Skeleton } from '@pkgs/ui-root-client/skeleton';
import { StackVertical } from '@pkgs/ui-root-client/stack';
import type { JSX } from 'solid-js';
import { createMemo, For, Show } from 'solid-js';
import {
  BackgroundColorPicker,
  StyleCombobox,
  TraitCombobox,
} from './avatar-editor-pickers';
import { AvatarEditorSeedField } from './avatar-editor-seed-field';
import { selectedVariantForField } from './option-helpers';
import { ProfileDiceBearAvatar } from './patch-avatar-profile-dicebear-avatar';
import type { UseAvatarEditor } from './use-avatar-editor';
import { useAvatarEditor } from './use-avatar-editor';

const HERO_SIZE = 160;

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

function StyleAndTraits(props: {
  editor: UseAvatarEditor;
  seed: string;
}): JSX.Element {
  return (
    <>
      <StyleCombobox
        styleKey={props.editor.styleKey}
        seed={props.seed}
        seedFallback={props.editor.seedFallback}
        onChange={(key) => {
          props.editor.setDraft((d) => ({ ...d, style: key, options: {} }));
        }}
      />
      <For each={props.editor.featureEnums}>
        {(field, index) => (
          <TraitCombobox
            field={field}
            styleKey={props.editor.styleKey}
            seed={props.seed}
            options={props.editor.draft.options}
            selectedVariant={selectedVariantForField(
              field,
              props.editor.draft.options[field.key]
            )}
            seedFallback={props.editor.seedFallback}
            triggerTestId={index() === 0 ? Handles.profileAvatarTrait : null}
            onSelect={(variant) => {
              props.editor.updateOptions((o) => {
                const next = { ...o };
                if (variant === null) delete next[field.key];
                else next[field.key] = [variant];
                return next;
              });
            }}
          />
        )}
      </For>
      <For each={props.editor.colorFields}>
        {(field) => (
          <BackgroundColorPicker field={field} editor={props.editor} />
        )}
      </For>
    </>
  );
}

function EditorContent(props: { editor: UseAvatarEditor }): JSX.Element {
  const seed = () =>
    props.editor.draft.seed.trim() || props.editor.seedFallback;
  const heroConfig = createMemo<AvatarConfig>(() => ({
    style: props.editor.styleKey,
    seed: props.editor.effectiveSeed,
    options: props.editor.draft.options,
  }));

  return (
    <StackVertical gap="sm" paddingBottom="lg">
      <AvatarHero size={HERO_SIZE}>
        <AvatarPreviewSlot
          ready={props.editor.ready}
          config={heroConfig()}
          seedFallback={props.editor.seedFallback}
        />
      </AvatarHero>
      <Show when={props.editor.ready}>
        <StackVertical gap="sm">
          <AvatarEditorSeedField
            seed={props.editor.draft.seed}
            onSeedChange={props.editor.setSeed}
            onRandomize={props.editor.shuffleSeed}
            onCopy={props.editor.copySeed}
          />
          <StyleAndTraits editor={props.editor} seed={seed()} />
        </StackVertical>
      </Show>
    </StackVertical>
  );
}

export function AvatarEditorScreen(): JSX.Element {
  const editor = useAvatarEditor();

  return (
    <>
      <ConfirmationModal
        visible={editor.showDiscard}
        title={<Trans>Discard changes?</Trans>}
        message={<Trans>You have unsaved avatar changes.</Trans>}
        confirmLabel={<Trans>Discard</Trans>}
        variant="destructive"
        onConfirm={editor.confirmDiscard}
        onCancel={() => editor.setShowDiscard(false)}
        confirmDataSet={{ testid: Handles.profileAvatarDiscardConfirm }}
        cancelDataSet={{ testid: Handles.profileAvatarDiscardKeep }}
      />
      <FormScreen
        screenId="avatar-editor"
        breadcrumbs={[
          { name: <Trans>Profile</Trans>, onClick: editor.onBack },
          { name: <Trans>Avatar</Trans> },
        ]}
        cancel={{
          label: <Trans>Cancel</Trans>,
          onClick: editor.onBack,
          dataSet: { testid: Handles.profileAvatarCancel },
        }}
        submit={{
          label: <Trans>Save</Trans>,
          loadingLabel: <Trans>Saving…</Trans>,
          successLabel: <Trans>Saved</Trans>,
          errorLabel: <Trans>Couldn't save</Trans>,
          operation: editor.save,
          get disabled() {
            return !editor.dirty || editor.profileId === null;
          },
          dataSet: { testid: Handles.profileAvatarSave },
        }}
      >
        <EditorContent editor={editor} />
      </FormScreen>
    </>
  );
}
