/** @jsxImportSource solid-js */

import { componentId } from '@pkgs/ui-root-shared-ts/component-id';
import type { RadiusToken } from '@pkgs/ui-root-shared-ts/token-names';
import { createEffect, createSignal, type JSX, on } from 'solid-js';
import { radiusClass, spaced } from '../layout-classes';

/** Frame shape, width over height. */
export type ImageRatio = 'square' | '4:3' | '16:9' | 'auto';

/** `cover` fills the frame and crops, `contain` fits the whole picture. */
export type ImageFit = 'cover' | 'contain';

/** Frame width: 64, 128, 256 or the parent's width. */
export type ImageSize = 'sm' | 'md' | 'lg' | 'full';

export type ImageLoadState = 'loading' | 'loaded' | 'error';

export type ImageProps = {
  src: string;
  /** What the picture shows. `""` marks it decorative. */
  alt: string;
  /** Default `auto`. */
  ratio?: ImageRatio | undefined;
  /** Default `cover`. */
  fit?: ImageFit | undefined;
  radius?: RadiusToken | undefined;
  /** Default `full`. */
  size?: ImageSize | undefined;
  /** Default `lazy`. */
  loading?: 'lazy' | 'eager' | undefined;
  /** Rendered as `data-testid`. */
  testId?: string | undefined;
};

const RATIO: Readonly<Record<ImageRatio, string>> = {
  square: 'aspect-square',
  '4:3': 'aspect-4/3',
  '16:9': 'aspect-16/9',
  auto: '',
};

const FIT: Readonly<Record<ImageFit, string>> = {
  cover: 'object-cover',
  contain: 'object-contain',
};

const SIZE: Readonly<Record<ImageSize, string>> = {
  sm: 'w-16',
  md: 'w-32',
  lg: 'w-64',
  full: 'w-full',
};

function frameClass(image: ImageProps): string {
  return spaced([
    'box overflow-hidden bg-surface-muted',
    SIZE[image.size ?? 'full'],
    RATIO[image.ratio ?? 'auto'],
    radiusClass(image.radius),
  ]);
}

function pictureClass(image: ImageProps, state: ImageLoadState): string {
  const framed = (image.ratio ?? 'auto') !== 'auto';
  return spaced([
    'block w-full transition-opacity',
    framed ? 'absolute inset-0 h-full' : 'h-auto',
    FIT[image.fit ?? 'cover'],
    state === 'loaded' ? 'opacity-100' : 'opacity-0',
  ]);
}

/**
 * `Image` -- a picture in a fixed frame. The frame (`ratio`, `size`,
 * `radius`) is laid out before the file arrives, so loading never shifts the
 * page: a muted surface fills it while the image loads and stays if the file
 * fails. Loading is lazy unless `loading="eager"` (an image above the fold).
 *
 * `alt` is required. Describe what the picture shows; pass `alt=""` only for
 * a decorative picture next to text that already says it.
 *
 * `ratio="auto"` keeps the file's own shape, which cannot be known before
 * it loads; give a ratio whenever the shape is known.
 *
 * @example
 * ```tsx
 * <Image src={cover()} alt={t`Board after move 32`} ratio="4:3" radius="card" />
 * <Image src={photo()} alt={name()} ratio="square" size="sm" radius="full" />
 * ```
 */
export function Image(props: ImageProps): JSX.Element {
  const [state, setState] = createSignal<ImageLoadState>('loading');
  createEffect(
    on(
      () => props.src,
      () => setState('loading'),
      { defer: true }
    )
  );
  return (
    <div
      class={frameClass(props)}
      data-testid={props.testId}
      data-component={componentId('Image')}
      data-state={state()}
    >
      <img
        class={pictureClass(props, state())}
        src={props.src}
        alt={props.alt}
        loading={props.loading ?? 'lazy'}
        decoding="async"
        onLoad={() => setState('loaded')}
        onError={() => setState('error')}
      />
    </div>
  );
}
