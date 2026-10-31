/** @jsxImportSource solid-js */

import { Button } from '@pkgs/ui-root-client-ts/button';
import { Card } from '@pkgs/ui-root-client-ts/card';
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';

export default function CardExample(): JSX.Element {
  return (
    <ExampleRoot>
      <Card>
        <h2 class="text textHeading">{'Card title'}</h2>
        <p class="text text-text-secondary">
          {
            'One self-contained unit of content, raised on the surface tone inside a hairline. Flat: no shadow, no gradient.'
          }
        </p>
        <div class="box flex-row justify-end">
          <Button title={'Continue'} />
        </div>
      </Card>
    </ExampleRoot>
  );
}
