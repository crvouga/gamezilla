/**
 * Wide IslandGrid: wrapping row of cells. Reads each child's `span` prop
 * (from {@link Island}) to size the cell.
 */

import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import { componentDataSet } from '../../component-id';
import { ISLAND_GAP_STEP } from '../../theme/layout';
import { spacingScale } from '../../theme/scale';
import { Box } from '../box';
import type { IslandSpan } from '../island/island-types';
import type { IslandGridProps } from './island-grid-types';

function readSpan(child: ReactElement): IslandSpan {
  const props = child.props as { span?: IslandSpan };
  return props.span ?? 1;
}

function cellWidthCss(
  columns: number,
  span: IslandSpan,
  gapPx: number
): string {
  const gaps = columns - 1;
  const spanGaps = span - 1;
  // (span/columns) of the free space + the gaps that fall inside this cell
  return `calc((100% - ${gaps * gapPx}px) * ${span} / ${columns} + ${spanGaps * gapPx}px)`;
}

function IslandGridCell({
  columns,
  span,
  children,
}: {
  columns: number;
  span: IslandSpan;
  children: ReactNode;
}): ReactNode {
  const gapPx = spacingScale(ISLAND_GAP_STEP);
  const width = cellWidthCss(columns, span, gapPx);
  return (
    <Box
      sx={{
        flexGrow: 0,
        flexShrink: 0,
        flexBasis: width,
        maxWidth: width,
        minWidth: 0,
      }}
    >
      {children}
    </Box>
  );
}

export function IslandGridWide({
  columns,
  children,
  dataSet,
}: IslandGridProps): ReactNode {
  const cells = Children.map(children, (child) => {
    if (!isValidElement(child)) {
      return child;
    }
    const span = readSpan(child);
    return (
      <IslandGridCell columns={columns} span={span}>
        {child}
      </IslandGridCell>
    );
  });
  return (
    <Box
      sx={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: ISLAND_GAP_STEP,
        alignItems: 'stretch',
      }}
      {...componentDataSet('IslandGrid', dataSet)}
    >
      {cells}
    </Box>
  );
}
