import {
  Box,
  ConfirmationModal,
  FormActionsFooter,
  ScreenBase,
} from '@pkgs/ui';
import { Trans } from '@lingui/react/macro';
import { useRouter } from 'expo-router';

import { BackgroundBlock } from './avatar-editor-background-block';
import { ColorsBlock } from './avatar-editor-colors-block';
import { EffectsBlock } from './avatar-editor-effects-block';
import { FeaturesBlock } from './avatar-editor-features-block';
import { AvatarPreview } from './avatar-editor-preview';
import { StyleBlock } from './avatar-editor-style-block';
import { TransformBlock } from './avatar-editor-transform-block';
import { useAvatarEditor, type UseAvatarEditor } from './use-avatar-editor';

function EditorSections({ editor }: { editor: UseAvatarEditor }) {
  const {
    seedFallback,
    draft,
    setDraft,
    surface,
    setSurface,
    closeSurface,
    styleKey,
    byTab,
    featureEnums,
    updateOptions,
  } = editor;
  return (
    <>
      <StyleBlock
        styleKey={styleKey}
        draft={draft}
        seedFallback={seedFallback}
        setDraft={setDraft}
        surface={surface}
        setSurface={setSurface}
        closeSurface={closeSurface}
      />
      <FeaturesBlock
        featureEnums={featureEnums}
        draft={draft}
        styleKey={styleKey}
        seedFallback={seedFallback}
        updateOptions={updateOptions}
        surface={surface}
        setSurface={setSurface}
        closeSurface={closeSurface}
      />
      <ColorsBlock
        colorFields={byTab.colors}
        draft={draft}
        updateOptions={updateOptions}
        surface={surface}
        setSurface={setSurface}
        closeSurface={closeSurface}
      />
      <EffectsBlock
        effectFields={byTab.effects}
        draft={draft}
        updateOptions={updateOptions}
      />
      <BackgroundBlock
        fields={byTab.background}
        draft={draft}
        updateOptions={updateOptions}
        surface={surface}
        setSurface={setSurface}
        closeSurface={closeSurface}
      />
      <TransformBlock
        fields={byTab.transform}
        draft={draft}
        updateOptions={updateOptions}
      />
    </>
  );
}

function EditorBody({ editor }: { editor: UseAvatarEditor }) {
  const { seedFallback, initialized, previewConfig, shuffleSeed, copySeed } =
    editor;
  return (
    <Box>
      <AvatarPreview
        previewConfig={previewConfig}
        seedFallback={seedFallback}
        initialized={initialized}
        shuffleSeed={shuffleSeed}
        copySeed={copySeed}
      />
      {initialized ? <EditorSections editor={editor} /> : null}
    </Box>
  );
}

export function AvatarEditorScreen() {
  const router = useRouter();
  const editor = useAvatarEditor();
  const {
    profileId,
    showDiscard,
    setShowDiscard,
    confirmDiscard,
    onBack,
    initialized,
    dirty,
    save,
    resetStyleDefaults,
  } = editor;

  return (
    <>
      <ConfirmationModal
        visible={showDiscard}
        title={<Trans>Discard changes?</Trans>}
        message={<Trans>You have unsaved avatar changes.</Trans>}
        confirmLabel={<Trans>Discard</Trans>}
        variant="destructive"
        onConfirm={confirmDiscard}
        onCancel={() => setShowDiscard(false)}
      />
      <ScreenBase
        breadcrumbs={[
          { name: <Trans>Profile</Trans>, onPress: onBack },
          { name: <Trans>Avatar</Trans> },
        ]}
        actions={[
          {
            type: 'secondary',
            label: <Trans>Reset</Trans>,
            onPress: resetStyleDefaults,
            disabled: !initialized,
            overflow: 'never',
          },
        ]}
        scroll
        footer={
          <FormActionsFooter
            cancel={{ label: <Trans>Cancel</Trans>, onPress: onBack }}
            submit={{
              label: <Trans>Save</Trans>,
              loadingLabel: <Trans>Saving…</Trans>,
              successLabel: <Trans>Saved</Trans>,
              errorLabel: <Trans>Couldn't save</Trans>,
              operation: save,
              onSuccess: () => router.back(),
              disabled: !dirty || profileId === null,
            }}
          />
        }
        content={({ sx }) => (
          <Box style={sx}>
            <EditorBody editor={editor} />
          </Box>
        )}
      />
    </>
  );
}
