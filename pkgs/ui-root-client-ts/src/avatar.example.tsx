/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { Avatar } from './avatar';
import { sampleAvatarSvg } from './avatar-sample-svg';
import { ExampleRoot } from './example-root';
import { Gamepad2Icon } from './icons';
import { SchemePreview } from './scheme-preview';
import { useThemeTokens } from './theme-context';

function Row(props: { label: string; children: JSX.Element }): JSX.Element {
  return (
    <div class="box gap-2">
      <p class="text textFootnote">{props.label}</p>
      <div class="box flex-row flex-wrap gap-3 items-center">
        {props.children}
      </div>
    </div>
  );
}

export default function AvatarExample(): JSX.Element {
  const tokens = useThemeTokens();
  const svg = (): string => sampleAvatarSvg(tokens.palette());
  return (
    <ExampleRoot>
      <SchemePreview>
        <div class="box gap-4">
          <Row label="Named sizes (xs 24 · sm 32 · md 40 · lg 56 · xl 96)">
            <Avatar size="xs" />
            <Avatar size="sm" />
            <Avatar size="md" />
            <Avatar size="lg" />
            <Avatar size="xl" />
          </Row>
          <Row label="Initials on the muted plate, and on status plates">
            <Avatar initials="JD" size="sm" />
            <Avatar initials="AB" size="md" />
            <Avatar initials="XY" size="lg" background="success" />
            <Avatar initials="ZZ" size="lg" background="destructive" />
          </Row>
          <Row label="Image (uri)">
            <Avatar uri="https://i.pravatar.cc/100?u=1" alt="Ada" size="md" />
            <Avatar uri="https://i.pravatar.cc/100?u=2" alt="Bo" size="lg" />
          </Row>
          <Row label="SVG (e.g. DiceBear), with and without the hairline ring">
            <Avatar svg={svg()} size="md" />
            <Avatar svg={svg()} size="lg" />
            <Avatar svg={svg()} size="lg" ring={false} />
          </Row>
          <Row label="Icon plate (not a person)">
            <Avatar icon={Gamepad2Icon} size="md" />
            <Avatar icon={Gamepad2Icon} size="lg" />
          </Row>
          <Row label="Nobody yet (person placeholder)">
            <Avatar size="md" />
            <Avatar size="lg" ring={false} />
            <Avatar size="lg" background="onTintScrim" foreground="onPrimary" />
          </Row>
        </div>
      </SchemePreview>
    </ExampleRoot>
  );
}
