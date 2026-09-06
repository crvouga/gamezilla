/** @jsxImportSource solid-js */
/** `SectionCard` -- bordered, collapsible section. */

import type { JSX } from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import { Box } from '../box';
import { Collapsible } from '../collapsible';

export type SectionCardProps = {
  title: string;
  defaultOpen?: boolean | undefined;
  children: JSX.Element;
  dataSet?: ComponentDataSet | undefined;
};

export function SectionCard(props: SectionCardProps): JSX.Element {
  return (
    <Box
      dataSet={{ component: 'SectionCard', ...props.dataSet }}
      sx={{
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: 'border',
        borderRadius: 'md',
        overflow: 'hidden',
        mb: 2,
        px: 3,
      }}
    >
      <Collapsible title={props.title} defaultOpen={props.defaultOpen}>
        <Box sx={{ pb: 3 }}>{props.children}</Box>
      </Collapsible>
    </Box>
  );
}
