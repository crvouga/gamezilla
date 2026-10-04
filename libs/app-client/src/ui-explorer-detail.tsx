/** @jsxImportSource solid-js */
import { ExplorerDetail } from '@pkgs/ui-client/explorer-detail';
import { useLocalSearchParams } from '@pkgs/ui-client/app-router';
import type { JSX } from 'solid-js';

export default function UiExplorerDetailRoute(): JSX.Element {
  const params = useLocalSearchParams<{ component?: string | undefined }>();
  const componentId = () => params().component ?? '';
  return (
    <ExplorerDetail
      componentId={componentId()}
      hrefFor={(id) => `/ui/${id}`}
      listHref="/ui"
    />
  );
}
