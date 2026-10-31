/** @jsxImportSource solid-js */

import type {
  ImageFit,
  ImageRatio,
  ImageSize,
} from '@pkgs/ui-root-client-ts/image';
import { Image } from '@pkgs/ui-root-client-ts/image';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { For, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';

/** A 4:3 picture that needs no network. */
const PICTURE = `data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 4 3'><rect width='4' height='3' opacity='0.2'/><circle cx='2' cy='1.5' r='1' opacity='0.5'/></svg>"
)}`;
/** Not a decodable image, so it fails without a request. */
const MISSING = 'data:image/png;base64,AAAA';

const RATIOS: readonly ImageRatio[] = ['square', '4:3', '16:9', 'auto'];
const FITS: readonly ImageFit[] = ['cover', 'contain'];
const SIZES: readonly ImageSize[] = ['sm', 'md', 'lg'];

export default function ImageExample(): JSX.Element {
  return (
    <ExampleRoot>
      <ExampleSection title="Ratios (size md)">
        <StackHorizontal gap="md" wrap align="start">
          <For each={RATIOS}>
            {(ratio) => (
              <StackVertical gap="xs">
                <Image
                  src={PICTURE}
                  alt={`A ${ratio} picture`}
                  ratio={ratio}
                  size="md"
                  radius="control"
                />
                <P variant="footnote">{ratio}</P>
              </StackVertical>
            )}
          </For>
        </StackHorizontal>
      </ExampleSection>
      <ExampleSection title="Fit in a square frame">
        <StackHorizontal gap="md">
          <For each={FITS}>
            {(fit) => (
              <Image
                src={PICTURE}
                alt={`Picture, ${fit}`}
                ratio="square"
                fit={fit}
                size="md"
                radius="card"
              />
            )}
          </For>
        </StackHorizontal>
      </ExampleSection>
      <ExampleSection title="Sizes, round">
        <StackHorizontal gap="md" align="center">
          <For each={SIZES}>
            {(size) => (
              <Image
                src={PICTURE}
                alt={`Picture, ${size}`}
                ratio="square"
                size={size}
                radius="full"
              />
            )}
          </For>
        </StackHorizontal>
      </ExampleSection>
      <ExampleSection title="Full width, eager">
        <Image
          src={PICTURE}
          alt="A wide picture"
          ratio="16:9"
          radius="card"
          loading="eager"
        />
      </ExampleSection>
      <ExampleSection title="Failed to load: the placeholder stays">
        <Image
          src={MISSING}
          alt="A picture that did not load"
          ratio="4:3"
          size="md"
          radius="control"
        />
      </ExampleSection>
    </ExampleRoot>
  );
}
