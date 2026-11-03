import { Trans } from '@lingui/solid/macro';
import { Avatar } from '@pkgs/ui-root-client-ts/avatar';
import { Text } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Match, Switch } from 'solid-js';
import { botName } from './custom-game-bot-name';
import type { FrameHolder, FramePeople } from './game-frame-view-types';

/** Up to two initials of a plain name, for a story's stand-in picture. */
function initialsOf(name: string): string {
  return name
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}

/** A person known by id: the live username, else the plain name. */
export function FramePersonName(props: {
  readonly person: string;
  readonly plainName: string;
  readonly people?: FramePeople | undefined;
  readonly bold?: boolean | undefined;
}): JSX.Element {
  const plain = (): JSX.Element =>
    props.bold === true ? (
      <Text variant="bodyBold">{props.plainName}</Text>
    ) : (
      props.plainName
    );
  return <>{props.people?.name?.(props.person, props.bold) ?? plain()}</>;
}

/** A person's picture: the live one, else their initials. */
export function FramePersonAvatar(props: {
  readonly person: string;
  readonly plainName: string;
  readonly size: number;
  readonly people?: FramePeople | undefined;
}): JSX.Element {
  return (
    <>
      {props.people?.avatar?.(props.person, props.size) ?? (
        <Avatar size={props.size} initials={initialsOf(props.plainName)} />
      )}
    </>
  );
}

const personOf = (holder: FrameHolder): string =>
  'person' in holder ? holder.person : '';

/** Whoever holds a seat, as the seat's name reads. */
export function FrameHolderName(props: {
  readonly holder: FrameHolder;
  readonly plainName: string;
  readonly people?: FramePeople | undefined;
}): JSX.Element {
  const person = (): JSX.Element => (
    <FramePersonName
      person={personOf(props.holder)}
      plainName={props.plainName}
      people={props.people}
    />
  );
  return (
    <Switch fallback={<Trans>Closed seat</Trans>}>
      <Match when={props.holder.kind === 'person'}>{person()}</Match>
      <Match when={props.holder.kind === 'invitation'}>
        <Trans>Invited:</Trans> {person()}
      </Match>
      <Match when={props.holder.kind === 'bot'}>
        {botName(props.holder.kind === 'bot' ? props.holder.level : undefined)}
      </Match>
      <Match when={props.holder.kind === 'local'}>
        <Trans>Player on this device</Trans>
      </Match>
      <Match when={props.holder.kind === 'open'}>
        <Trans>Open seat</Trans>
      </Match>
    </Switch>
  );
}

/**
 * The seat's picture. While the game is set up (`setup`) an invited person,
 * a guest on this device and an open seat have their own; once it is
 * played only a person and a bot do.
 */
export function FrameHolderAvatar(props: {
  readonly holder: FrameHolder;
  readonly plainName: string;
  readonly size: number;
  readonly setup?: boolean | undefined;
  readonly people?: FramePeople | undefined;
}): JSX.Element {
  const kind = () => props.holder.kind;
  return (
    <Switch fallback={<Avatar size={props.size} />}>
      <Match
        when={
          kind() === 'person' ||
          (props.setup === true && kind() === 'invitation')
        }
      >
        <FramePersonAvatar
          person={personOf(props.holder)}
          plainName={props.plainName}
          size={props.size}
          people={props.people}
        />
      </Match>
      <Match when={kind() === 'bot'}>
        <Avatar size={props.size} kind="bot" />
      </Match>
      <Match when={props.setup === true && kind() === 'local'}>
        <Avatar size={props.size} kind="guest" />
      </Match>
      <Match when={props.setup === true && kind() === 'open'}>
        <Avatar size={props.size} kind="emptySeat" />
      </Match>
    </Switch>
  );
}
