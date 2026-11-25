import { DeviceAvatar } from '@libs/profile-client-ts/device-avatar';
import { parseAvatarConfig } from '@libs/profile-shared-ts/avatar-config';
import { Trans, useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import type { TextRole } from '@pkgs/ui-root-client-ts/text';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import type { TextLines, TextWrap } from '@pkgs/ui-root-client-ts/text-classes';
import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';

/** A person in a space, as others may see them. */
export type SpacePerson = {
  /** Profile id (account or install id). */
  readonly id: string;
  /** Name as the moderation policy lets others see it, without `@`. */
  readonly name: string;
  /** Persisted avatar config JSON, or null before the profile syncs. */
  readonly avatarConfig: string | null;
  /** A server-classified automated account, labelled "Bot". */
  readonly bot: boolean;
};

/** A person's avatar; nothing when the person is not known yet. */
export function SpacePersonAvatar(props: {
  readonly person: SpacePerson | null;
  readonly size: number;
  readonly vividBackdrop?: boolean | undefined;
}): JSX.Element {
  return (
    <Show when={props.person} keyed>
      {(person) => (
        <DeviceAvatar
          avatarConfig={parseAvatarConfig(person.avatarConfig)}
          seedFallback={person.id}
          name={person.name}
          size={props.size}
          vividBackdrop={props.vividBackdrop ?? false}
        />
      )}
    </Show>
  );
}

function BotLabel(props: { readonly person: SpacePerson }): JSX.Element {
  return (
    <Show when={props.person.bot}>
      {/* A badge keeps to its row's top edge; its own row centres it on
          the name's line. */}
      <StackHorizontal align="center">
        <Badge
          label={<Trans>Bot</Trans>}
          intent="neutral"
          size="sm"
          dataSet={{ testid: `account-automation-${props.person.id}` }}
        />
      </StackHorizontal>
    </Show>
  );
}

/**
 * A person's shown name with their "Bot" label. Clamped names are a block,
 * otherwise the name runs inline.
 */
export function SpacePersonName(props: {
  readonly person: SpacePerson | null;
  readonly variant?: TextRole | undefined;
  readonly lines?: TextLines | undefined;
  /** `break`: a long name breaks anywhere, never cut short. */
  readonly wrap?: TextWrap | undefined;
  readonly testId?: string | undefined;
}): JSX.Element {
  const { t } = useLingui();
  // A person whose name has not arrived yet still reads as someone.
  const shown = (name: string): string =>
    name.trim() === '' ? t`Guest` : name;
  return (
    <Show when={props.person} keyed>
      {(person) => (
        <Show
          when={props.lines !== undefined}
          fallback={
            <>
              <Text variant={props.variant ?? 'body'} testId={props.testId}>
                {shown(person.name)}
              </Text>{' '}
              <BotLabel person={person} />
            </>
          }
        >
          {/* The name gives up room first, cut short with an ellipsis;
              the label after it keeps its size, on the same line. */}
          <StackHorizontal align="center" gap="xs" grow>
            <StackVertical shrink>
              <P
                variant={props.variant ?? 'body'}
                lines={props.lines}
                wrap={props.wrap}
                testId={props.testId}
              >
                {shown(person.name)}
              </P>
            </StackVertical>
            <BotLabel person={person} />
          </StackHorizontal>
        </Show>
      )}
    </Show>
  );
}
