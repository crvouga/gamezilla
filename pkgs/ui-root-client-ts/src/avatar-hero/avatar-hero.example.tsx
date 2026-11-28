/** @jsxImportSource @solidjs/web */
import { useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import { Avatar } from '@pkgs/ui-root-client-ts/avatar';
import { AvatarHero } from '@pkgs/ui-root-client-ts/avatar-hero';
import { ShuffleIcon } from '@pkgs/ui-root-client-ts/icons';
import { useThemeTokens } from '@pkgs/ui-root-client-ts/theme-context';
import type { JSX } from '@solidjs/web';
import { createSignal } from 'solid-js';
import { sampleAvatarSvg } from '../../storybook/fixtures/avatar-sample-svg';
import { ExampleRoot } from '../../storybook/fixtures/example-root';

const HERO_SIZE = 160;

export default function AvatarHeroExample(): JSX.Element {
  const { t } = useLingui();
  const tokens = useThemeTokens();
  const [n, setN] = createSignal(0);
  const plates = ['info', 'success', 'warning', 'destructive'] as const;
  const svg = (): string =>
    sampleAvatarSvg(tokens.palette, plates[n() % plates.length]);

  return (
    <ExampleRoot>
      <div class="box gap-4">
        <AvatarHero
          size={HERO_SIZE}
          action={{
            label: t`Randomize`,
            onClick: () => setN((c) => c + 1),
            icon: <ShuffleIcon size={20} />,
          }}
        >
          <Avatar svg={svg()} size={HERO_SIZE} />
        </AvatarHero>
        <p class="text textCaption">{`Shuffles: ${n()}`}</p>
        <AvatarHero
          size={HERO_SIZE}
          action={{
            label: t`Randomize`,
            onClick: () => undefined,
            icon: <ShuffleIcon size={20} />,
            disabled: true,
          }}
        >
          <Avatar size={HERO_SIZE} />
        </AvatarHero>
        <p class="text textCaption">{'Disabled action'}</p>
        <AvatarHero size={HERO_SIZE}>
          <Avatar you initials="ME" size={HERO_SIZE} />
        </AvatarHero>
        <p class="text textCaption">{'Your own face, no action'}</p>
      </div>
    </ExampleRoot>
  );
}
