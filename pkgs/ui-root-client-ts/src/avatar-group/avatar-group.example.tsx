/** @jsxImportSource solid-js */

import { Avatar } from '@pkgs/ui-root-client-ts/avatar';
import { AvatarGroup } from '@pkgs/ui-root-client-ts/avatar-group';
import { sampleAvatarSvg } from '@pkgs/ui-root-client-ts/avatar-sample-svg';
import { useThemeTokens } from '@pkgs/ui-root-client-ts/theme-context';
import { For, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { SchemePreview } from '../../storybook/fixtures/scheme-preview';

function Section(props: { label: string; children: JSX.Element }): JSX.Element {
  return (
    <div class="box gap-2">
      <p class="text textFootnote">{props.label}</p>
      {props.children}
    </div>
  );
}

/** 1,243 faces: three shown, `+1.2K` more. */
const CROWD: readonly number[] = Array.from({ length: 1243 }, (_, i) => i);

export default function AvatarGroupExample(): JSX.Element {
  const tokens = useThemeTokens();
  const svg = (): string => sampleAvatarSvg(tokens.palette(), 'success');
  return (
    <ExampleRoot>
      <SchemePreview>
        <div class="box gap-6">
          <Section label="Default overlap (40% of size), canvas rings">
            <AvatarGroup size={32}>
              <Avatar initials="A" size={32} />
              <Avatar initials="B" size={32} background="success" />
              <Avatar size={32} />
              <Avatar svg={svg()} size={32} />
            </AvatarGroup>
          </Section>
          <Section label="maxVisible={3} shows the +N disc">
            <AvatarGroup size={40} maxVisible={3}>
              <Avatar initials="JD" size={40} />
              <Avatar initials="AB" size={40} background="success" />
              <Avatar initials="XY" size={40} background="warning" />
              <Avatar initials="ZZ" size={40} background="destructive" />
              <Avatar uri="https://i.pravatar.cc/100?u=9" size={40} />
            </AvatarGroup>
          </Section>
          <Section label="Every kind in one strip: you, a person, a guest, a bot, an open seat">
            <AvatarGroup size={40}>
              <Avatar you initials="ME" size={40} />
              <Avatar initials="JD" size={40} />
              <Avatar kind="guest" size={40} />
              <Avatar kind="bot" size={40} />
              <Avatar kind="emptySeat" size={40} />
            </AvatarGroup>
          </Section>
          <Section label="A big crowd: the +N disc is compact from 1,000">
            <AvatarGroup size={32} maxVisible={3}>
              <For each={CROWD}>
                {(index) => <Avatar initials={String(index % 10)} size={32} />}
              </For>
            </AvatarGroup>
          </Section>
          <Section label="Tighter overlap (8px), size 48">
            <AvatarGroup size={48} overlap={8}>
              <Avatar size={48} />
              <Avatar initials="M" size={48} />
              <Avatar initials="K" size={48} background="info" />
            </AvatarGroup>
          </Section>
          <Section label="onClick makes the strip one button (hover, focus)">
            <AvatarGroup
              size={32}
              maxVisible={4}
              onClick={() => undefined}
              aria-label="Members"
            >
              <Avatar initials="1" size={32} />
              <Avatar initials="2" size={32} background="success" />
              <Avatar initials="3" size={32} background="warning" />
              <Avatar initials="4" size={32} background="destructive" />
              <Avatar initials="5" size={32} />
            </AvatarGroup>
          </Section>
        </div>
      </SchemePreview>
    </ExampleRoot>
  );
}
