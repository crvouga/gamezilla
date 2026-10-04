/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { Button } from './button';
import { Card } from './card';
import { ExampleRoot } from './example-root';

export default function CardExample(): JSX.Element {
  return (
    <ExampleRoot>
      <Card>
        <h2 class="text textHeading">{'Card title'}</h2>
        <p class="text text-text-secondary">
          {'One self-contained unit of content on a bordered surface.'}
        </p>
        <div class="box flex-row justify-end">
          <Button title={'Continue'} />
        </div>
      </Card>
    </ExampleRoot>
  );
}
