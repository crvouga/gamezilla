/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../explorer/example-root';
import { Notice } from './notice';

export default function NoticeExample(): JSX.Element {
  return (
    <ExampleRoot>
      <Notice>{'Changes apply the next time you sign in.'}</Notice>
      <Notice tone="error">
        {"Couldn't find an account with that email."}
      </Notice>
    </ExampleRoot>
  );
}
