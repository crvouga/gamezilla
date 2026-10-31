/** @jsxImportSource solid-js */

import { Button } from '@pkgs/ui-root-client-ts/button';
import { Spinner } from '@pkgs/ui-root-client-ts/spinner';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';
import { SchemePreview } from '../../storybook/fixtures/scheme-preview';

export default function SpinnerExample(): JSX.Element {
  return (
    <ExampleRoot>
      <ExampleSection title="Sizes: sm 16, md 24, lg 40">
        <StackHorizontal align="center" gap="xl">
          <Spinner size="sm" />
          <Spinner size="md" />
          <Spinner size="lg" />
        </StackHorizontal>
      </ExampleSection>
      <ExampleSection title="Colors">
        <StackHorizontal align="center" gap="xl">
          <Spinner color="secondary" />
          <Spinner color="default" />
          <Spinner color="tint" />
          <Spinner color="destructive" />
        </StackHorizontal>
      </ExampleSection>
      <ExampleSection title="Inside a button">
        <StackHorizontal align="center" gap="sm">
          <Button title="Save" loading />
          <Button title="Save" intent="neutral" loading />
        </StackHorizontal>
      </ExampleSection>
      <SchemePreview>
        <StackHorizontal align="center" gap="xl">
          <Spinner size="sm" />
          <Spinner />
          <Spinner size="lg" />
        </StackHorizontal>
      </SchemePreview>
    </ExampleRoot>
  );
}
