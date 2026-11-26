import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { H3 } from '@pkgs/ui-root-client-ts/heading';
import type { MutationStep } from '@pkgs/ui-root-client-ts/mutation-step';
import { ResponsiveSurface } from '@pkgs/ui-root-client-ts/responsive-surface';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { Tabs } from '@pkgs/ui-root-client-ts/tabs';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from '@solidjs/web';
import { Match, Show, Switch } from 'solid-js';
import type { SpaceManagementPage } from './space-management-context';

export type SpaceManagementViewProps = {
  readonly page: SpaceManagementPage;
  readonly onNavigate: (next: SpaceManagementPage) => void;
  readonly onClose: () => void;
  readonly people: JSX.Element;
  readonly sharing: JSX.Element;
  readonly spaceName: string;
  readonly onRename?: (() => void) | undefined;
  readonly removal?: MutationStep | undefined;
};

/** Shows a space’s people, sharing and settings, including removal confirmations. */
export function SpaceManagementView(
  props: SpaceManagementViewProps
): JSX.Element {
  const { t } = useLingui();
  const settings = () => props.page.area === 'settings';
  const tabs = () => [
    ...(settings() ? [{ value: 'general' as const, label: t`General` }] : []),
    { value: 'people' as const, label: t`People` },
    { value: 'sharing' as const, label: t`Sharing` },
  ];
  return (
    <ResponsiveSurface
      visible
      title={
        props.removal?.title() ??
        (settings() ? t`Space settings` : t`People in this space`)
      }
      size={settings() ? 'large' : 'medium'}
      onClose={() => props.onClose()}
      closeDataSet={{
        testid:
          props.page.tab === 'sharing'
            ? Handles.spaceShareClose
            : Handles.spaceMembersClose,
      }}
    >
      <Show
        when={props.removal}
        keyed
        fallback={
          <Tabs
            aria-label={settings() ? t`Space settings` : t`People and sharing`}
            testId={Handles.spaceManagementTabs}
            items={tabs()}
            value={props.page.tab}
            onValueChange={(tab) => {
              if (settings()) props.onNavigate({ area: 'settings', tab });
              else if (tab !== 'general')
                props.onNavigate({ area: 'people', tab });
            }}
          >
            {(tab) => (
              <StackVertical paddingY="md" gap="sm">
                <Switch>
                  <Match when={tab === 'general'}>
                    <H3 size="label">
                      <Trans>Space name</Trans>
                    </H3>
                    <P dataSet={{ testid: Handles.spaceSettingsName }}>
                      {props.spaceName}
                    </P>
                    <Show when={props.onRename} keyed>
                      {(rename) => (
                        <Button
                          title={<Trans>Edit name</Trans>}
                          onClick={rename}
                          dataSet={{ testid: Handles.spaceRename }}
                        />
                      )}
                    </Show>
                  </Match>
                  <Match when={tab === 'people'}>{props.people}</Match>
                  <Match when={tab === 'sharing'}>{props.sharing}</Match>
                </Switch>
              </StackVertical>
            )}
          </Tabs>
        }
      >
        {(step) => <step.Body />}
      </Show>
    </ResponsiveSurface>
  );
}
