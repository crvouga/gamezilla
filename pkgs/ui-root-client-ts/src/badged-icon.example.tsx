/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { BadgedIcon } from './badged-icon';
import { ExampleRoot } from './example-root';
import { ExampleSection } from './example-section';
import { BellIcon, MailIcon } from './icons';
import { StackHorizontal } from './stack';

export default function BadgedIconExample(): JSX.Element {
  return (
    <ExampleRoot>
      <ExampleSection title="No badge, a count, a capped count">
        <StackHorizontal gap="lg" align="center">
          <BadgedIcon>
            <BellIcon size={24} />
          </BadgedIcon>
          <BadgedIcon badge="3">
            <BellIcon size={24} />
          </BadgedIcon>
          <BadgedIcon badge="99+">
            <BellIcon size={24} />
          </BadgedIcon>
        </StackHorizontal>
      </ExampleSection>
      <ExampleSection title="Destructive intent">
        <BadgedIcon badge="1" intent="destructive">
          <MailIcon size={24} />
        </BadgedIcon>
      </ExampleSection>
    </ExampleRoot>
  );
}
