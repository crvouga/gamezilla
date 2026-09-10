/** @jsxImportSource solid-js */
/** `SectionCard` -- bordered, collapsible section. */

import type { JSX } from 'solid-js';
import { type ComponentDataSet, dataAttrs } from '../../component-id';
import { Collapsible } from '../collapsible';

export type SectionCardProps = {
  title: string;
  defaultOpen?: boolean | undefined;
  children: JSX.Element;
  dataSet?: ComponentDataSet | undefined;
};

export function SectionCard(props: SectionCardProps): JSX.Element {
  return (
    <div
      class="box border border-solid border-border rounded-[10px] overflow-hidden mb-2 px-3"
      {...dataAttrs({ component: 'SectionCard', ...props.dataSet })}
    >
      <Collapsible title={props.title} defaultOpen={props.defaultOpen}>
        <div class="box pb-3">{props.children}</div>
      </Collapsible>
    </div>
  );
}
