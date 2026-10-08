import { useLingui } from '@lingui/solid/macro';
import type {
  ReportPart,
  SpecEntry,
} from '@pkgs/harness-report-shared/explorer-types';
import { MenuRow } from '@pkgs/ui-root-client/menu-row';
import { MenuSection } from '@pkgs/ui-root-client/menu-section';
import { createMemo, For, Show } from 'solid-js';

/** Links to all independent evidence associated with a selected spec. */
export function SpecReportParts(props: {
  entry: SpecEntry;
  parts: readonly ReportPart[];
  onOpen: (kind: string, path: string) => void;
}) {
  const { t } = useLingui();
  const relevant = createMemo(() =>
    props.parts
      .filter((part) => part.kind !== 'behavior')
      .map((part) => ({
        part,
        checks: part.checks.filter((check) => {
          const source = check.specPath?.replaceAll('\\', '/');
          return (
            source === props.entry.path ||
            source?.endsWith(`/${props.entry.path}`)
          );
        }),
      }))
      .filter((row) => row.checks.length > 0)
  );
  return (
    <Show when={relevant().length}>
      <MenuSection title={t`Related report parts`}>
        <For each={relevant()}>
          {(row) => (
            <MenuRow
              title={row.part.title}
              caption={t`${row.checks.length} checks for this spec`}
              onClick={() => props.onOpen(row.part.kind, props.entry.path)}
            />
          )}
        </For>
      </MenuSection>
    </Show>
  );
}
