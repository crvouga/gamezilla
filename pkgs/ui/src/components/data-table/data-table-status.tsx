/** @jsxImportSource solid-js */
import { useLingui } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';

import type { SxInput } from '../../theme';
import { Box } from '../box';
import { EmptyState } from '../empty-state';
import { ErrorState } from '../error-state';
import { LoadingState } from '../loading-state';
import type { PageView } from './data-table-page-load';

export function dataTableShellSx(sx: SxInput | undefined): SxInput {
  return [
    {
      flex: 1,
      minHeight: 0,
      minWidth: 0,
      alignSelf: 'stretch',
      backgroundColor: 'surface',
      borderWidth: 1,
      borderColor: 'border',
      borderRadius: 'lg',
      overflow: 'hidden',
    },
    sx,
  ];
}

export function DataTableStatusBody<T>(props: {
  readonly view: PageView<T>;
  readonly onRetry: () => void;
  readonly emptyTitle: JSX.Element;
  readonly emptyBody: JSX.Element | undefined;
}): JSX.Element {
  const { t } = useLingui();
  const content = (): JSX.Element => {
    const view = props.view;
    if (view.status === 'loading') {
      return <LoadingState variant="compact" caption={t`Loading…`} />;
    }
    if (view.status === 'error') {
      return (
        <ErrorState
          variant="compact"
          title={t`Failed to load`}
          body={view.message}
          retry={{ onClick: props.onRetry }}
        />
      );
    }
    return (
      <EmptyState
        variant="compact"
        title={props.emptyTitle}
        body={props.emptyBody}
      />
    );
  };
  return (
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
      {content()}
    </Box>
  );
}
