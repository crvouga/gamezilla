import { Trans, useLingui } from '@lingui/solid/macro';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { For, type JSX, Match, Show, Switch } from 'solid-js';
import { ContentThumbnail } from './content-thumbnail';

/** A saved attempt or playtest, as the library lists it. */
type ListedAttempt = {
  readonly id: string;
  /** Empty when the source has not reached this device. */
  readonly title: string;
  /** The puzzle definition its thumbnail draws. */
  readonly preview?: string | undefined;
};

/**
 * Which of the person's attempts a list holds; its section's title says
 * where they stand, so its rows carry no status of their own.
 */
export type ContentAttemptList = 'unfinished' | 'finished' | 'playtest';

function ListTitle(props: { list: ContentAttemptList }): JSX.Element {
  return (
    <Switch>
      <Match when={props.list === 'unfinished'}>
        <Trans>Continue playing</Trans>
      </Match>
      <Match when={props.list === 'finished'}>
        <Trans>Finished</Trans>
      </Match>
      <Match when={props.list === 'playtest'}>
        <Trans>Your private playtests</Trans>
      </Match>
    </Switch>
  );
}

function ListFooter(props: { list: ContentAttemptList }): JSX.Element {
  return (
    <Switch>
      <Match when={props.list === 'unfinished'}>
        <Trans>
          Each attempt keeps your progress at the edition you started.
        </Trans>
      </Match>
      <Match when={props.list === 'playtest'}>
        <Trans>Playtests change no personal or pack progress.</Trans>
      </Match>
    </Switch>
  );
}

/** One list of the person's attempts, each row opening where they left it. */
export function ContentAttemptSection(props: {
  list: ContentAttemptList;
  attempts: readonly ListedAttempt[];
  renderPreview: ((definition: string) => JSX.Element) | undefined;
  onOpenAttempt: (attemptId: string) => void;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <Show when={props.attempts.length > 0}>
      <MenuSection
        title={<ListTitle list={props.list} />}
        footer={
          props.list === 'finished' ? undefined : (
            <ListFooter list={props.list} />
          )
        }
      >
        <For each={props.attempts.map((attempt) => attempt.id)}>
          {(id) => {
            const attempt = () =>
              props.attempts.find((entry) => entry.id === id);
            return (
              <MenuRow
                leading={
                  <ContentThumbnail
                    size="xl"
                    renderPreview={props.renderPreview}
                    kind="puzzle"
                    preview={attempt()?.preview}
                  />
                }
                title={(attempt()?.title ?? '') || t`Saved puzzle`}
                onClick={() => props.onOpenAttempt(id)}
                dataSet={{ testid: `content-attempt-${id}` }}
              />
            );
          }}
        </For>
      </MenuSection>
    </Show>
  );
}
