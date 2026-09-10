/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../explorer/example-root';
import { UserIcon } from '../icons';
import { Avatar } from './avatar';

const SAMPLE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#7c3aed" />
      <stop offset="100%" stop-color="#06b6d4" />
    </linearGradient>
  </defs>
  <rect width="64" height="64" fill="url(#g)" />
  <circle cx="32" cy="26" r="10" fill="#fff" />
  <rect x="14" y="40" width="36" height="18" rx="9" fill="#fff" />
</svg>
`.trim();

export default function AvatarExample(): JSX.Element {
  return (
    <ExampleRoot>
      <p class="text textCaption">{'Initials'}</p>
      <div class="box flex-row gap-3 items-center">
        <Avatar initials="JD" size={32} />
        <Avatar initials="AB" size={40} background="success" />
        <Avatar initials="XY" size={48} background="warning" />
        <Avatar initials="ZZ" size={56} background="destructive" />
      </div>

      <p class="text textCaption">{'Image (uri)'}</p>
      <div class="box flex-row gap-3 items-center">
        <Avatar uri="https://i.pravatar.cc/100?u=1" size={40} />
        <Avatar uri="https://i.pravatar.cc/100?u=2" size={48} />
        <Avatar uri="https://i.pravatar.cc/100?u=3" size={56} />
      </div>

      <p class="text textCaption">{'SVG (e.g. DiceBear)'}</p>
      <div class="box flex-row gap-3 items-center">
        <Avatar svg={SAMPLE_SVG} size={40} />
        <Avatar svg={SAMPLE_SVG} size={56} />
        <Avatar svg={SAMPLE_SVG} size={72} />
      </div>

      <p class="text textCaption">{'Icon placeholder'}</p>
      <div class="box flex-row gap-3 items-center">
        <Avatar
          icon={UserIcon}
          size={40}
          background="outline"
          foreground="tabIconDefault"
        />
        <Avatar
          icon={UserIcon}
          size={56}
          background="outline"
          foreground="tabIconDefault"
        />
        <Avatar
          icon={UserIcon}
          size={56}
          background="rgba(255,255,255,0.22)"
          foreground="rgba(255,255,255,0.92)"
        />
      </div>

      <p class="text textCaption">{'Empty plate (loading)'}</p>
      <div class="box flex-row gap-3 items-center">
        <Avatar size={40} background="surface" />
        <Avatar size={56} background="surface" />
        <Avatar size={72} background="surface" />
      </div>
    </ExampleRoot>
  );
}
