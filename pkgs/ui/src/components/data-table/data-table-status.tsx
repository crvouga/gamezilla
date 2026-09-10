/** @jsxImportSource solid-js */
import { useLingui } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';

import { EmptyState } from '../empty-state';
import { ErrorState } from '../error-state';
import { LoadingState } from '../loading-state';
import type { PageView } from './data-table-page-load';

export const DATA_TABLE_SHELL_CLASS =
  'flex-1 min-h-0 min-w-0 self-stretch bg-surface border border-border rounded-[14px] overflow-hidden';

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
    <div class="box grow min-h-0 min-w-0 self-stretch items-center justify-center">
      {content()}
    </div>
  );
}
