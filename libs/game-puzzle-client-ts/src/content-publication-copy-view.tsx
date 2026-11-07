import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { t as message } from '@lingui/core/macro';
import { useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { Spinner } from '@pkgs/ui-root-client-ts/spinner';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { Text } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Show } from 'solid-js';
import type { ContentPublicationCopyState } from './content-publication-copy-state';

export function publicationCopyLabel(
  state: ContentPublicationCopyState
): string {
  if (state.kind === 'reading') return message`Checking publication`;
  if (state.kind === 'pending')
    return state.connection === 'online'
      ? message`Awaiting confirmation`
      : message`Waiting for connection`;
  if (state.kind === 'edition')
    return state.current ? message`Published` : message`Previously published`;
  return message`Publish`;
}

export function PublicationCopyLead(props: {
  state: ContentPublicationCopyState;
  denial: DenialView | undefined;
  onView: () => void;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <Show
      when={props.denial}
      fallback={
        <Show
          when={props.state.kind === 'edition' && props.state.current}
          fallback={
            <StackHorizontal gap="xs" align="center">
              <Show
                when={
                  props.state.kind === 'reading' ||
                  (props.state.kind === 'pending' &&
                    props.state.connection === 'online')
                }
              >
                <Spinner size="sm" decorative />
              </Show>
              <Text
                variant="caption"
                role="status"
                testId="content-publication-status"
              >
                {publicationCopyLabel(props.state)}
              </Text>
            </StackHorizontal>
          }
        >
          <Button
            title={t`View published edition`}
            intent="primary"
            onClick={() => props.onView()}
            dataSet={{ testid: 'content-view-publication' }}
          />
        </Show>
      }
    >
      {(denial) => <DenialSurfaceView denial={denial()} variant="compact" />}
    </Show>
  );
}
