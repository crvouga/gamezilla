/** @jsxImportSource solid-js */

import { PRODUCT_NAME } from '@libs/product-identity-shared-ts/product-identity';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { CopyToClipboardField } from '@pkgs/ui-root-client-ts/copy-to-clipboard-field';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuScreen } from '@pkgs/ui-root-client-ts/menu-screen';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { type JSX, Show } from 'solid-js';

/** Which commit this build came from, with its date already formatted. */
export type CommitProvenance = {
  readonly fullHash: string;
  readonly shortHash: string;
  readonly committedAt: string;
};

export type AboutScreenViewProps = {
  readonly version: string;
  readonly buildMode: 'development' | 'production';
  /** `null` when the build carries no commit information. */
  readonly provenance: CommitProvenance | null;
  /** Address for reporting a security problem (a `mailto:` row). */
  readonly securityContact: string;
  /** Clipboard sink for the full commit hash. */
  readonly copy: (text: string) => Promise<void>;
};

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

/**
 * `/more/about`, presentational: app name, version, build mode, build
 * provenance and the security contact. `AboutScreen` reads the build-time
 * metadata and hands it in.
 */
export function AboutScreenView(props: AboutScreenViewProps): JSX.Element {
  const { t } = useLingui();
  const buildMode = (): string =>
    props.buildMode === 'development' ? t`Development` : t`Production`;

  return (
    <MenuScreen
      screenId="about"
      breadcrumbs={[
        { name: <Trans>Profile</Trans>, href: '/profile' },
        { name: <Trans>Settings</Trans>, href: '/more' },
        { name: <Trans>About</Trans> },
      ]}
    >
      <MenuSection title={<Trans>App</Trans>}>
        <MenuRow title={t`Name`} value={PRODUCT_NAME} />
        <MenuRow
          title={t`Version`}
          value={props.version}
          dataSet={{ testid: Handles.aboutVersion }}
        />
        <MenuRow title={t`Platform`} value="web" />
        <MenuRow title={t`Build mode`} value={buildMode()} />
      </MenuSection>

      <BuildSection provenance={props.provenance} />

      <MenuSection title={<Trans>Security</Trans>}>
        <MenuRow
          title={t`Report a security problem`}
          value={props.securityContact}
          href={`mailto:${props.securityContact}`}
          dataSet={{ testid: Handles.aboutSecurityContact }}
        />
      </MenuSection>

      <Show when={props.provenance}>
        {(p) => (
          <CopyToClipboardField
            label={<Trans>Full commit</Trans>}
            helperText={t`Tap to copy`}
            value={p().fullHash}
            copy={props.copy}
            selectable
            dataSet={{ testid: 'about-full-commit' }}
          />
        )}
      </Show>
    </MenuScreen>
  );
}
