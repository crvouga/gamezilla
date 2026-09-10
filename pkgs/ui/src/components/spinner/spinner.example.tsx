/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../explorer/example-root';
import { Spinner } from './spinner';

export default function SpinnerExample(): JSX.Element {
  return (
    <ExampleRoot>
      <div class="box flex-row gap-4 items-center">
        <Spinner size="small" />
        <Spinner size="large" />
        <Spinner color="success" size="large" />
        <Spinner color="destructive" size="large" />
      </div>
    </ExampleRoot>
  );
}
