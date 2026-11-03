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
import { useLingui as useLinguiRuntime } from '@lingui/solid';
import { type Accessor, createMemo, type JSX } from 'solid-js';
import { AboutScreenView, type CommitProvenance } from './about-screen-view';
import { formatCommitDate } from './format-commit-date';

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

/** `/more/about`: wires `AboutScreenView` to the build-time metadata. */
export function AboutScreen(): JSX.Element {
  const provenance = useCommitProvenance();
  return (
    <AboutScreenView
      version={APP_VERSION}
      buildMode={import.meta.env.DEV ? 'development' : 'production'}
      provenance={provenance()}
      securityContact={SECURITY_CONTACT}
      copy={writeClipboardText}
    />
  );
}
