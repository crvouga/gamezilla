/** @jsxImportSource solid-js */

import { AVATAR_SEAT_COLORS, Avatar } from '@pkgs/ui-root-client-ts/avatar';
import { sampleAvatarSvg } from '@pkgs/ui-root-client-ts/avatar-sample-svg';
import { Gamepad2Icon } from '@pkgs/ui-root-client-ts/icons';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { useThemeTokens } from '@pkgs/ui-root-client-ts/theme-context';
import { For, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';
import { SchemePreview } from '../../storybook/fixtures/scheme-preview';

function Row(props: { title: string; children: JSX.Element }): JSX.Element {
  return (
    <ExampleSection title={props.title}>
      <StackHorizontal gap="md" align="center" wrap>
        {props.children}
      </StackHorizontal>
    </ExampleSection>
  );
}

function Kinds(): JSX.Element {
  const tokens = useThemeTokens();
  const svg = (): string => sampleAvatarSvg(tokens.palette());
  return (
    <>
      <Row title="person: picture, initials, placeholder">
        <Avatar svg={svg()} alt="Ada" size="lg" />
        <Avatar initials="JD" alt="Jane Doe" size="lg" />
        <Avatar alt="Someone" size="lg" />
      </Row>
      <Row title="bot: the bot glyph, never a person">
        <Avatar kind="bot" size="md" />
        <Avatar kind="bot" alt="Stockfish" size="lg" />
      </Row>
      <Row title="guest: a person marked as guest">
        <Avatar kind="guest" size="md" />
        <Avatar kind="guest" size="lg" />
        <Avatar kind="guest" initials="RB" alt="Robin" size="lg" />
      </Row>
      <Row title="emptySeat: a dashed ring, nobody in it">
        <Avatar kind="emptySeat" size="md" />
        <Avatar kind="emptySeat" size="lg" />
      </Row>
      <Row title="you: the soft blue plate">
        <Avatar you initials="ME" size="md" />
        <Avatar you size="lg" />
        <Avatar you initials="ME" size="xl" />
      </Row>
    </>
  );
}

function SeatColors(): JSX.Element {
  return (
    <>
      <Row title="seatColor: player1..player8 as the ring">
        <For each={AVATAR_SEAT_COLORS}>
          {(color) => <Avatar initials="P" seatColor={color} size="md" />}
        </For>
      </Row>
      <Row title="seatColor on a bot, a guest, an empty seat and you">
        <Avatar kind="bot" seatColor="player2" size="lg" />
        <Avatar kind="guest" seatColor="player3" size="lg" />
        <Avatar kind="emptySeat" seatColor="player4" size="lg" />
        <Avatar you initials="ME" seatColor="player1" size="lg" />
      </Row>
    </>
  );
}

function Plates(): JSX.Element {
  return (
    <>
      <Row title="Named sizes (xs 24 · sm 32 · md 40 · lg 56 · xl 96)">
        <Avatar size="xs" />
        <Avatar size="sm" />
        <Avatar size="md" />
        <Avatar size="lg" />
        <Avatar size="xl" />
      </Row>
      <Row title="Initials on status plates; no hairline ring">
        <Avatar initials="XY" size="lg" background="success" />
        <Avatar initials="ZZ" size="lg" background="destructive" />
        <Avatar initials="AB" size="lg" ring={false} />
      </Row>
      <Row title="Image (uri)">
        <Avatar uri="https://i.pravatar.cc/100?u=1" alt="Ada" size="md" />
        <Avatar uri="https://i.pravatar.cc/100?u=2" alt="Bo" size="lg" />
      </Row>
      <Row title="Icon plate (not a person: a game, a device)">
        <Avatar icon={Gamepad2Icon} size="md" />
        <Avatar icon={Gamepad2Icon} size="lg" />
      </Row>
      <Row title="Placeholder on a vivid backdrop">
        <Avatar size="lg" background="onTintScrim" foreground="onPrimary" />
      </Row>
    </>
  );
}

export default function AvatarExample(): JSX.Element {
  return (
    <ExampleRoot>
      <SchemePreview>
        <StackVertical gap="lg">
          <Kinds />
          <SeatColors />
          <Plates />
        </StackVertical>
      </SchemePreview>
    </ExampleRoot>
  );
}
