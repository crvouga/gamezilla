import { DeviceAvatar } from '@libs/profile-client-ts/device-avatar';
import { parseAvatarConfig } from '@libs/profile-shared-ts/avatar-config';
import { Trans } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import type { TextRole } from '@pkgs/ui-root-client-ts/text';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import type { TextLines } from '@pkgs/ui-root-client-ts/text-classes';
import type { JSX } from 'solid-js';
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
      <Badge
        label={<Trans>Bot</Trans>}
        intent="neutral"
        size="sm"
        dataSet={{ testid: `account-automation-${props.person.id}` }}
      />
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
  readonly testId?: string | undefined;
}): JSX.Element {
  return (
    <Show when={props.person} keyed>
      {(person) => (
        <Show
          when={props.lines !== undefined}
          fallback={
            <>
              <Text variant={props.variant ?? 'body'} testId={props.testId}>
                {person.name}
              </Text>
              <BotLabel person={person} />
            </>
          }
        >
          <StackHorizontal align="center" gap="xs">
            <P
              variant={props.variant ?? 'body'}
              lines={props.lines}
              testId={props.testId}
            >
              {person.name}
            </P>
            <BotLabel person={person} />
          </StackHorizontal>
        </Show>
      )}
    </Show>
  );
}
