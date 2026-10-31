import { formatCommitDate } from './format-commit-date';
/** @jsxImportSource solid-js */
/**
 * `/more/about` — app name / version / build provenance. Commit hash + date
 * come from `import.meta.env.VITE_COMMIT_*` inlined at build time.
 */

import {
  APP_VERSION,
  getCommitDate,
  getCommitHash,
  getShortCommitHash,
  hasCommitProvenance,
  SECURITY_CONTACT,
} from '@libs/app-root-shared-ts/app-metadata';
import { writeClipboardText } from '@libs/app-root-shared-ts/write-clipboard-text';
import { PRODUCT_NAME } from '@libs/product-identity-shared-ts/product-identity';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { useLingui as useLinguiRuntime } from '@lingui/solid';
import { Trans, useLingui } from '@lingui/solid/macro';
import { CopyToClipboardField } from '@pkgs/ui-root-client-ts/copy-to-clipboard-field';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuScreen } from '@pkgs/ui-root-client-ts/menu-screen';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
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
    <MenuScreen
      screenId="about"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, href: '/' },
        { name: <Trans>Settings</Trans>, href: '/more' },
        { name: <Trans>About</Trans> },
      ]}
    >
      <MenuSection title={<Trans>App</Trans>}>
        <MenuRow title={t`Name`} value={PRODUCT_NAME} />
        <MenuRow
          title={t`Version`}
          value={APP_VERSION}
          dataSet={{ testid: Handles.aboutVersion }}
        />
        <MenuRow title={t`Platform`} value="web" />
        <MenuRow title={t`Build mode`} value={buildMode()} />
      </MenuSection>

      <BuildSection provenance={provenance()} />

      <MenuSection title={<Trans>Security</Trans>}>
        <MenuRow
          title={t`Report a security problem`}
          value={SECURITY_CONTACT}
          href={`mailto:${SECURITY_CONTACT}`}
          dataSet={{ testid: Handles.aboutSecurityContact }}
        />
      </MenuSection>

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
    </MenuScreen>
  );
}
