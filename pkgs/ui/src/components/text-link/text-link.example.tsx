/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../explorer/example-root';
import { TextLink } from './text-link';

export default function TextLinkExample(): JSX.Element {
  return (
    <ExampleRoot>
      <TextLink href="#create">{'Create account'}</TextLink>
      <TextLink href="#intercepted" onClick={() => undefined}>
        {'Handled in place'}
      </TextLink>
    </ExampleRoot>
  );
}
