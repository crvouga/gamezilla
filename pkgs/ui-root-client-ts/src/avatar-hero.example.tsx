/** @jsxImportSource solid-js */
import { useLingui } from '@lingui/solid/macro';
import { createSignal, type JSX } from 'solid-js';
import { Avatar } from './avatar';
import { AvatarHero } from './avatar-hero';
import { sampleAvatarSvg } from './avatar-sample-svg';
import { ExampleRoot } from './example-root';
import { ShuffleIcon } from './icons';
import { SchemePreview } from './scheme-preview';
import { useThemeTokens } from './theme-context';

const HERO_SIZE = 160;

export default function AvatarHeroExample(): JSX.Element {
  const { t } = useLingui();
  const tokens = useThemeTokens();
  const [n, setN] = createSignal(0);
  const plates = ['info', 'success', 'warning', 'destructive'] as const;
  const svg = (): string =>
    sampleAvatarSvg(tokens.palette(), plates[n() % plates.length]);

  return (
    <ExampleRoot>
      <SchemePreview>
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
        </div>
      </SchemePreview>
    </ExampleRoot>
  );
}
