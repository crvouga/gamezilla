import { formatCommitDate } from './format-commit-date';
/** @jsxImportSource solid-js */
/**
 * `/more/about` — app name / version / build provenance. Commit hash + date
 * come from `import.meta.env.VITE_COMMIT_*` inlined at build time.
 */

import {
  APP_NAME,
  APP_VERSION,
  getCommitDate,
  getCommitHash,
  getShortCommitHash,
  hasCommitProvenance,
} from '@libs/app-shared/app-metadata';
import { writeClipboardText } from '@libs/app-shared/write-clipboard-text';
import { Handles } from '@libs/test-ids-shared/handles';
import { useLingui as useLinguiRuntime } from '@lingui/solid';
import { Trans, useLingui } from '@lingui/solid/macro';
import { CopyToClipboardField } from '@pkgs/ui-client/copy-to-clipboard-field';
import { MenuRow } from '@pkgs/ui-client/menu-row';
import { MenuSection } from '@pkgs/ui-client/menu-section';
import { ScreenBase } from '@pkgs/ui-client/screen-base';
import { type Accessor, createMemo, type JSX, Show } from 'solid-js';

type CommitProvenance = {
  readonly fullHash: string;
  readonly shortHash: string;
  readonly committedAt: string;
};

function useCommitProvenance(): Accessor<CommitProvenance | null> {
  const { i18n } = useLinguiRuntime();
  return createMemo(() => {
    if (!hasCommitProvenance()) return null;
    return {
      fullHash: getCommitHash(),
      shortHash: getShortCommitHash(),
      committedAt: formatCommitDate(getCommitDate(), i18n().locale),
    };
  });
}

function BuildSection(props: {
  readonly provenance: CommitProvenance | null;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <MenuSection
      title={<Trans>Build</Trans>}
      dataSet={{ testid: 'about-build' }}
    >
      <Show
        when={props.provenance}
        fallback={<MenuRow title={t`Commit`} value={t`Unavailable`} />}
      >
        {(p) => (
          <>
            <MenuRow
              title={t`Commit`}
              value={p().shortHash}
              dataSet={{ testid: 'about-commit' }}
            />
            <MenuRow title={t`Committed`} value={p().committedAt} />
          </>
        )}
      </Show>
    </MenuSection>
  );
}

export function AboutScreen(): JSX.Element {
  const { t } = useLingui();
  const provenance = useCommitProvenance();
  const buildMode = (): string =>
    import.meta.env.DEV ? t`Development` : t`Production`;

  return (
    <ScreenBase
      screenId="about"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, href: '/' },
        { name: <Trans>Settings</Trans>, href: '/more' },
        { name: <Trans>About</Trans> },
      ]}
      scroll
      content={({ bodyClass }) => (
        <div class={`box ${bodyClass} gap-5`}>
          <MenuSection title={<Trans>App</Trans>}>
            <MenuRow title={t`Name`} value={APP_NAME} />
            <MenuRow
              title={t`Version`}
              value={APP_VERSION}
              dataSet={{ testid: Handles.aboutVersion }}
            />
            <MenuRow title={t`Platform`} value="web" />
            <MenuRow title={t`Build mode`} value={buildMode()} />
          </MenuSection>

          <BuildSection provenance={provenance()} />

          <Show when={provenance()}>
            {(p) => (
              <CopyToClipboardField
                label={<Trans>Full commit</Trans>}
                helperText={t`Tap to copy`}
                value={p().fullHash}
                copy={writeClipboardText}
                selectable
                dataSet={{ testid: 'about-full-commit' }}
              />
            )}
          </Show>
        </div>
      )}
    />
  );
}
