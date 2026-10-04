/** @jsxImportSource solid-js */
import { useLingui } from '@lingui/solid/macro';
import { createSignal, type JSX } from 'solid-js';
import { Avatar } from './avatar';
import { AvatarHero } from './avatar-hero';
import { ExampleRoot } from './example-root';
import { ShuffleIcon } from './icons';

const SAMPLE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#fbbf24" />
  <circle cx="24" cy="28" r="4" fill="#111" />
  <circle cx="40" cy="28" r="4" fill="#111" />
  <path d="M20 42 Q32 52 44 42" stroke="#111" stroke-width="3" fill="none" />
</svg>
`.trim();

export default function AvatarHeroExample(): JSX.Element {
  const { t } = useLingui();
  const [n, setN] = createSignal(0);

  return (
    <ExampleRoot>
      <AvatarHero
        size={160}
        action={{
          label: t`Randomize`,
          onClick: () => setN((c) => c + 1),
          icon: <ShuffleIcon size={20} />,
        }}
      >
        <Avatar svg={SAMPLE_SVG} size={160} />
      </AvatarHero>
      <p class="text textCaption opacity-75">{`Shuffles: ${n()}`}</p>
    </ExampleRoot>
  );
}
