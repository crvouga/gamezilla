import type { Inspection } from '@libs/synthetic-population-shared-ts/inspection';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { CodeBlock } from '@pkgs/ui-root-client-ts/code-block';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { useMutationButton } from '@pkgs/ui-root-client-ts/use-mutation-button';
import { For, type JSX, Show } from 'solid-js';

export function SyntheticUserDom(props: {
  snapshot: Inspection | null;
  inspect: () => Promise<void>;
}): JSX.Element {
  const { t } = useLingui();
  const inspect = useMutationButton({
    labels: {
      idle: t`Capture live DOM`,
      success: t`Capture requested`,
      error: t`Try again`,
    },
    operation: () => props.inspect(),
  });
  return (
    <MenuSection
      title={<Trans>In-process UI inspector</Trans>}
      footer={
        <Trans>
          This is a sanitized DOM snapshot of the selected application instance.
          It is not a screenshot.
        </Trans>
      }
    >
      <Button
        {...inspect.buttonProps}
        dataSet={{ testid: 'synthetic-population-inspect' }}
      />
      <Show when={props.snapshot} keyed>
        {(view) => (
          <>
            <MenuRow title={<Trans>Current route</Trans>} value={view.route} />
            <For each={view.controls}>
              {(item) => (
                <MenuRow title={item.name || item.testId} caption={item.role} />
              )}
            </For>
            <For each={view.actions}>
              {(action) => (
                <MenuRow
                  title={action.action}
                  caption={String(action.atMs)}
                  value={action.outcome}
                />
              )}
            </For>
            <CodeBlock framed={false} testId="synthetic-population-dom">
              {view.html}
            </CodeBlock>
          </>
        )}
      </Show>
    </MenuSection>
  );
}
