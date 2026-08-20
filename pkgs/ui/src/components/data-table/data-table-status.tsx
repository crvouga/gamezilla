import type { ReactNode } from 'react';
import type { LayoutChangeEvent } from 'react-native';

import type { ComponentDataSet } from '../../component-id';
import type { SxInput } from '../../theme';
import { Box } from '../box';
import { EmptyState } from '../empty-state';
import { ErrorState } from '../error-state';
import { LoadingState } from '../loading-state';

export function dataTableShellSx(
  frameSx: SxInput | undefined,
  sx: SxInput | undefined
): SxInput {
  return [
    {
      flex: 1,
      minHeight: 0,
      minWidth: 0,
      alignSelf: 'stretch',
      backgroundColor: 'surface',
      borderWidth: 1,
      borderColor: 'border',
      borderRadius: 'lg' as const,
      overflow: 'hidden' as const,
    },
    frameSx,
    sx,
  ];
}

export function DataTableStatusShell(props: {
  readonly shellSx: SxInput;
  readonly dataSet: ComponentDataSet;
  readonly header: ReactNode;
  readonly children: ReactNode;
  readonly onLayout?: (e: LayoutChangeEvent) => void;
}): ReactNode {
  const { shellSx, dataSet, header, children, onLayout } = props;
  return (
    <Box sx={shellSx} dataSet={dataSet} onLayout={onLayout}>
      {header}
      <Box
        sx={{
          flexGrow: 1,
          minHeight: 0,
          minWidth: 0,
          alignSelf: 'stretch',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

export function DataTableLoadingBody(): ReactNode {
  return <LoadingState variant="compact" caption="Loading…" />;
}

export function DataTableErrorBody(props: {
  readonly message: string;
  readonly onRetry: () => void;
}): ReactNode {
  return (
    <ErrorState
      variant="compact"
      title="Failed to load"
      body={props.message}
      retry={{ onPress: props.onRetry }}
    />
  );
}

export function DataTableEmptyBody(props: {
  readonly title: ReactNode;
  readonly body: ReactNode | undefined;
}): ReactNode {
  if (props.body === undefined) {
    return <EmptyState variant="compact" title={props.title} />;
  }
  return <EmptyState variant="compact" title={props.title} body={props.body} />;
}
