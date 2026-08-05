import { useState } from 'react';
import { asLocalized } from '@pkgs/i18n';
import { Avatar } from '../avatar';
import { ShuffleIcon } from '../icons';
import { Text } from '../text';
import { AvatarHero } from './avatar-hero';
import { ExampleRoot } from '../explorer/example-root';

const SAMPLE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#fbbf24" />
  <circle cx="24" cy="28" r="4" fill="#111" />
  <circle cx="40" cy="28" r="4" fill="#111" />
  <path d="M20 42 Q32 52 44 42" stroke="#111" stroke-width="3" fill="none" />
</svg>
`.trim();

export default function AvatarHeroExample() {
  const [n, setN] = useState(0);

  return (
    <ExampleRoot>
      <AvatarHero
        size={160}
        action={{
          accessibilityLabel: asLocalized('Randomize'),
          onPress: () => setN((c) => c + 1),
          icon: <ShuffleIcon size={20} />,
        }}
      >
        <Avatar svg={SAMPLE_SVG} size={160} />
      </AvatarHero>
      <Text variant="caption" sx={{ opacity: 0.75 }} label={`Shuffles: ${n}`} />
    </ExampleRoot>
  );
}
